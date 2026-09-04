package com.vms_sunmi_app.camera

import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.google.zxing.BarcodeFormat
import com.google.zxing.ResultPoint
import com.journeyapps.barcodescanner.BarcodeCallback
import com.journeyapps.barcodescanner.BarcodeResult
import com.journeyapps.barcodescanner.DecoratedBarcodeView
import com.journeyapps.barcodescanner.DefaultDecoderFactory

class CameraScannerLayout(context: ThemedReactContext) : FrameLayout(context) {
    val barcodeView = DecoratedBarcodeView(context)

    init {
        barcodeView.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        val formats = listOf(
            BarcodeFormat.QR_CODE,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8
        )
        barcodeView.barcodeView.decoderFactory = DefaultDecoderFactory(formats)
        barcodeView.statusView.text = "หันกล้องไปที่ QR Code"
        addView(barcodeView)
    }

    override fun requestLayout() {
        super.requestLayout()
        post(measureAndLayoutRunnable)
    }

    private val measureAndLayoutRunnable = Runnable {
        measure(
            MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
        )
        layout(left, top, right, bottom)
    }
}

class CameraScannerViewManager : SimpleViewManager<CameraScannerLayout>() {

    override fun getName(): String {
        return "CameraScannerView"
    }

    override fun createViewInstance(reactContext: ThemedReactContext): CameraScannerLayout {
        val container = CameraScannerLayout(reactContext)
        val barcodeView = container.barcodeView

        var lastScannedCode = ""
        var lastScanTime = 0L

        barcodeView.decodeContinuous(object : BarcodeCallback {
            override fun barcodeResult(result: BarcodeResult?) {
                if (result != null && !result.text.isNullOrEmpty()) {
                    val code = result.text.trim()
                    val currentTime = System.currentTimeMillis()

                    if (code != lastScannedCode || (currentTime - lastScanTime) > 1500) {
                        lastScannedCode = code
                        lastScanTime = currentTime

                        val event = Arguments.createMap().apply {
                            putString("code", code)
                        }

                        val context = container.context as? ReactContext
                        context?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(
                            container.id,
                            "onBarcodeScanned",
                            event
                        )
                    }
                }
            }

            override fun possibleResultPoints(resultPoints: MutableList<ResultPoint>?) {
                // No-op
            }
        })

        barcodeView.resume()
        return container
    }

    @ReactProp(name = "isActive", defaultBoolean = true)
    fun setIsActive(view: CameraScannerLayout, isActive: Boolean) {
        if (isActive) {
            view.barcodeView.resume()
        } else {
            view.barcodeView.pause()
        }
    }

    @ReactProp(name = "torch", defaultBoolean = false)
    fun setTorch(view: CameraScannerLayout, torch: Boolean) {
        if (torch) {
            view.barcodeView.setTorchOn()
        } else {
            view.barcodeView.setTorchOff()
        }
    }

    override fun onDropViewInstance(view: CameraScannerLayout) {
        super.onDropViewInstance(view)
        view.barcodeView.pause()
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.of(
            "onBarcodeScanned",
            MapBuilder.of("registrationName", "onBarcodeScanned")
        )
    }
}
