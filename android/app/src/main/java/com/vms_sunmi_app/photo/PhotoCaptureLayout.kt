package com.vms_sunmi_app.photo

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.graphics.SurfaceTexture
import android.hardware.camera2.*
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Size
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.widget.*
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.common.MapBuilder
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*

/**
 * Native Camera2 photo capture view for React Native.
 * Renders a live camera preview and calls JS with a file path on capture.
 */
class PhotoCaptureLayout(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {

    private lateinit var textureView: TextureView
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var backgroundHandler: Handler? = null
    private var backgroundThread: HandlerThread? = null
    private var cameraId: String = ""

    var onPhotoTaken: ((String) -> Unit)? = null
    var onError: ((String) -> Unit)? = null
    var onReady: (() -> Unit)? = null

    init {
        // TextureView fills the parent
        textureView = TextureView(reactContext)
        textureView.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        addView(textureView)

        textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(surface: SurfaceTexture, w: Int, h: Int) {
                startCamera()
            }
            override fun onSurfaceTextureSizeChanged(s: SurfaceTexture, w: Int, h: Int) {}
            override fun onSurfaceTextureDestroyed(s: SurfaceTexture): Boolean {
                stopCamera()
                return true
            }
            override fun onSurfaceTextureUpdated(s: SurfaceTexture) {}
        }
    }

    fun startCamera() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED) {
            onError?.invoke("ไม่มีสิทธิ์เข้าถึงกล้อง กรุณาอนุญาตใน Settings")
            return
        }

        startBackgroundThread()

        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        try {
            // Pick back-facing camera
            cameraId = manager.cameraIdList.firstOrNull { id ->
                val chars = manager.getCameraCharacteristics(id)
                chars.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
            } ?: manager.cameraIdList.first()

            val characteristics = manager.getCameraCharacteristics(cameraId)
            val map = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)!!

            // Use the smallest available size ≥ 1MP for performance on V2Pro
            val outputSizes = map.getOutputSizes(ImageFormat.JPEG)
            val captureSize = outputSizes
                .filter { it.width >= 640 && it.height >= 480 }
                .minByOrNull { it.width * it.height }
                ?: outputSizes.first()

            imageReader = ImageReader.newInstance(captureSize.width, captureSize.height, ImageFormat.JPEG, 2)
            imageReader?.setOnImageAvailableListener({ reader ->
                val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
                try {
                    val buffer = image.planes[0].buffer
                    val bytes = ByteArray(buffer.remaining())
                    buffer.get(bytes)

                    val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
                    val dir = File(context.cacheDir, "vms_photos")
                    dir.mkdirs()
                    val file = File(dir, "IMG_$timeStamp.jpg")
                    FileOutputStream(file).use { it.write(bytes) }

                    android.util.Log.d("PhotoCapture", "Photo captured and saved to: ${file.absolutePath}")
                    onPhotoTaken?.invoke(file.absolutePath)
                } catch (e: Exception) {
                    android.util.Log.e("PhotoCapture", "Save photo failed: ${e.message}", e)
                    onError?.invoke("บันทึกรูปล้มเหลว: ${e.message}")
                } finally {
                    image.close()
                }
            }, backgroundHandler)

            manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    createPreviewSession()
                }
                override fun onDisconnected(camera: CameraDevice) { camera.close() }
                override fun onError(camera: CameraDevice, error: Int) {
                    camera.close()
                    onError?.invoke("ไม่สามารถเปิดกล้องได้ (error=$error)")
                }
            }, backgroundHandler)
        } catch (e: Exception) {
            onError?.invoke("Camera error: ${e.message}")
        }
    }

    private fun createPreviewSession() {
        val texture = textureView.surfaceTexture ?: return
        val surface = Surface(texture)
        val previewBuilder = cameraDevice!!.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
        previewBuilder.addTarget(surface)

        val surfaces = listOf(surface, imageReader!!.surface)
        cameraDevice!!.createCaptureSession(surfaces, object : CameraCaptureSession.StateCallback() {
            override fun onConfigured(session: CameraCaptureSession) {
                captureSession = session
                previewBuilder.set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
                previewBuilder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                session.setRepeatingRequest(previewBuilder.build(), null, backgroundHandler)
                onReady?.invoke()
            }
            override fun onConfigureFailed(session: CameraCaptureSession) {
                onError?.invoke("Camera session configure failed")
            }
        }, backgroundHandler)
    }

    fun takePhoto() {
        val camera = cameraDevice ?: run {
            android.util.Log.e("PhotoCapture", "takePhoto: cameraDevice is null")
            onError?.invoke("กล้องยังไม่พร้อม")
            return
        }
        val session = captureSession ?: run {
            android.util.Log.e("PhotoCapture", "takePhoto: captureSession is null")
            onError?.invoke("เซสชันกล้องยังไม่พร้อม")
            return
        }
        val reader = imageReader ?: run {
            android.util.Log.e("PhotoCapture", "takePhoto: imageReader is null")
            onError?.invoke("เซนเซอร์กล้องยังไม่พร้อม")
            return
        }

        try {
            val captureBuilder = camera.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
            captureBuilder.addTarget(reader.surface)
            captureBuilder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
            captureBuilder.set(CaptureRequest.JPEG_QUALITY, 85.toByte())
            captureBuilder.set(CaptureRequest.JPEG_ORIENTATION, 90) // Sunmi portrait

            android.util.Log.d("PhotoCapture", "Triggering still capture request...")
            session.capture(captureBuilder.build(), object : CameraCaptureSession.CaptureCallback() {
                override fun onCaptureCompleted(session: CameraCaptureSession, request: CaptureRequest, result: TotalCaptureResult) {
                    android.util.Log.d("PhotoCapture", "onCaptureCompleted fired")
                }
                override fun onCaptureFailed(session: CameraCaptureSession, request: CaptureRequest, failure: CaptureFailure) {
                    android.util.Log.e("PhotoCapture", "onCaptureFailed: reason=${failure.reason}")
                    onError?.invoke("การบันทึกภาพล้มเหลว (reason=${failure.reason})")
                }
            }, backgroundHandler)
        } catch (e: Exception) {
            android.util.Log.e("PhotoCapture", "takePhoto exception: ${e.message}", e)
            onError?.invoke("เกิดข้อผิดพลาดในการถ่ายภาพ: ${e.message}")
        }
    }

    fun stopCamera() {
        captureSession?.close()
        captureSession = null
        cameraDevice?.close()
        cameraDevice = null
        imageReader?.close()
        imageReader = null
        stopBackgroundThread()
    }

    private fun startBackgroundThread() {
        backgroundThread = HandlerThread("CameraBackground").also { it.start() }
        backgroundHandler = Handler(backgroundThread!!.looper)
    }

    private fun stopBackgroundThread() {
        backgroundThread?.quitSafely()
        backgroundThread = null
        backgroundHandler = null
    }

    override fun requestLayout() {
        super.requestLayout()
        post {
            measure(
                MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
            )
            layout(left, top, right, bottom)
        }
    }
}
