package com.vms_sunmi_app.photo

import com.facebook.react.bridge.*
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

/**
 * React Native ViewManager for PhotoCaptureLayout.
 * Exposed as native view "PhotoCaptureView".
 * Props:
 *   isActive (bool): start/stop camera
 * Events:
 *   onPhotoTaken { nativeEvent: { path: string } }
 *   onCameraError { nativeEvent: { message: string } }
 */
class PhotoCaptureViewManager : SimpleViewManager<PhotoCaptureLayout>() {

    override fun getName(): String = "PhotoCaptureView"

    override fun createViewInstance(reactContext: ThemedReactContext): PhotoCaptureLayout {
        val view = PhotoCaptureLayout(reactContext)

        view.onPhotoTaken = { path ->
            val event = Arguments.createMap().apply { putString("path", path) }
            val ctx = view.context as? com.facebook.react.bridge.ReactContext
            ctx?.getJSModule(RCTEventEmitter::class.java)
                ?.receiveEvent(view.id, "onPhotoTaken", event)
        }

        view.onError = { message ->
            val event = Arguments.createMap().apply { putString("message", message) }
            val ctx = view.context as? com.facebook.react.bridge.ReactContext
            ctx?.getJSModule(RCTEventEmitter::class.java)
                ?.receiveEvent(view.id, "onCameraError", event)
        }

        view.onReady = {
            val ctx = view.context as? com.facebook.react.bridge.ReactContext
            ctx?.getJSModule(RCTEventEmitter::class.java)
                ?.receiveEvent(view.id, "onCameraReady", Arguments.createMap())
        }

        return view
    }

    @ReactProp(name = "isActive", defaultBoolean = false)
    fun setIsActive(view: PhotoCaptureLayout, isActive: Boolean) {
        if (isActive) view.startCamera() else view.stopCamera()
    }

    override fun receiveCommand(view: PhotoCaptureLayout, commandId: String?, args: ReadableArray?) {
        android.util.Log.d("PhotoCapture", "receiveCommand String: $commandId")
        when (commandId) {
            "takePhoto", "1" -> view.takePhoto()
            else -> super.receiveCommand(view, commandId, args)
        }
    }

    override fun receiveCommand(view: PhotoCaptureLayout, commandId: Int, args: ReadableArray?) {
        android.util.Log.d("PhotoCapture", "receiveCommand Int: $commandId")
        when (commandId) {
            1 -> view.takePhoto()
            else -> super.receiveCommand(view, commandId, args)
        }
    }

    override fun getCommandsMap(): Map<String, Int> {
        return MapBuilder.of("takePhoto", 1)
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.of(
            "onPhotoTaken", MapBuilder.of("registrationName", "onPhotoTaken"),
            "onCameraError", MapBuilder.of("registrationName", "onCameraError"),
            "onCameraReady", MapBuilder.of("registrationName", "onCameraReady")
        )
    }

    override fun onDropViewInstance(view: PhotoCaptureLayout) {
        super.onDropViewInstance(view)
        view.stopCamera()
    }
}
