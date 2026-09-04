package com.vms_sunmi_app.sunmi

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SunmiScannerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener, ActivityEventListener {

    companion object {
        var instance: SunmiScannerModule? = null
        var reactAppContext: ReactApplicationContext? = null
        const val ACTION_DATA_DISMISS = "com.sunmi.scanner.ACTION_DATA_DISMISS"
        const val ACTION_SCAN_RESULT = "com.sunmi.action.SCAN_RESULT"
        const val ACTION_SCAN_START = "com.sunmi.scanner.ACTION_SCAN_START"
        const val DATA = "data"
        const val START_SCAN_REQUEST_CODE = 0x101
    }

    private var isReceiverRegistered = false
    private var cameraScanPromise: Promise? = null

    private val scanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent == null) return
            val action = intent.action
            if (action == ACTION_DATA_DISMISS || action == ACTION_SCAN_RESULT) {
                var code = intent.getStringExtra(DATA)
                if (code.isNullOrEmpty()) {
                    val bundle: Bundle? = intent.extras
                    code = bundle?.getString(DATA)
                }
                if (!code.isNullOrEmpty()) {
                    val cleanCode = code.trim()
                    sendEvent("onBarcodeScanned", cleanCode)
                    cameraScanPromise?.resolve(cleanCode)
                    cameraScanPromise = null
                }
            }
        }
    }

    init {
        instance = this
        reactAppContext = reactContext
        reactContext.addLifecycleEventListener(this)
        reactContext.addActivityEventListener(this)
        registerScannerReceiver()
    }

    fun sendHardwareKey(keyName: String) {
        sendEvent("onHardwareKeyPress", keyName)
    }

    fun sendBarcodeScanned(code: String) {
        sendEvent("onBarcodeScanned", code)
    }

    override fun getName(): String {
        return "SunmiScanner"
    }

    private fun registerScannerReceiver() {
        if (!isReceiverRegistered) {
            try {
                val filter = IntentFilter()
                filter.addAction(ACTION_DATA_DISMISS)
                filter.addAction(ACTION_SCAN_RESULT)
                reactContext.registerReceiver(scanReceiver, filter)
                isReceiverRegistered = true
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun unregisterScannerReceiver() {
        if (isReceiverRegistered) {
            try {
                reactContext.unregisterReceiver(scanReceiver)
                isReceiverRegistered = false
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun sendEvent(eventName: String, params: Any?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
        }
    }

    @ReactMethod
    fun addListener(eventName: String?) {
        // Required for RN built-in Event Emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN built-in Event Emitter
    }

    @ReactMethod
    fun openCameraScanner(promise: Promise) {
        try {
            cameraScanPromise = promise

            // 1. Send Sunmi hardware/camera trigger broadcasts
            val startIntent = Intent(ACTION_SCAN_START)
            reactContext.sendBroadcast(startIntent)

            val scanIntent = Intent("com.sunmi.scan.ACTION_SCAN")
            reactContext.sendBroadcast(scanIntent)

            // 2. Try launching camera scan activity if available
            try {
                val actIntent = Intent("com.sunmi.scan")
                actIntent.putExtra("CURRENT_PPI", 0x0003)
                actIntent.putExtra("PLAY_SOUND", true)
                actIntent.putExtra("PLAY_VIBRATE", true)
                val currentAct = reactContext.currentActivity
                if (currentAct != null) {
                    currentAct.startActivityForResult(actIntent, START_SCAN_REQUEST_CODE)
                }
            } catch (e: Exception) {
                // Ignore if app uses direct broadcast
            }
        } catch (e: Exception) {
            promise.reject("CAMERA_SCAN_ERROR", e.message)
        }
    }

    @ReactMethod
    fun startScan(promise: Promise) {
        openCameraScanner(promise)
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == START_SCAN_REQUEST_CODE && data != null) {
            try {
                val bundle: Bundle? = data.extras
                var scannedText: String? = null

                if (bundle != null) {
                    @Suppress("UNCHECKED_CAST")
                    val resultList = bundle.getSerializable("data") as? ArrayList<HashMap<String, String>>
                    if (resultList != null && resultList.isNotEmpty()) {
                        scannedText = resultList[0]["VALUE"]
                    }
                }

                if (scannedText.isNullOrEmpty()) {
                    scannedText = data.getStringExtra("result") ?: data.getStringExtra("data")
                }

                if (!scannedText.isNullOrEmpty()) {
                    val cleanCode = scannedText.trim()
                    sendEvent("onBarcodeScanned", cleanCode)
                    cameraScanPromise?.resolve(cleanCode)
                } else {
                    cameraScanPromise?.resolve("")
                }
            } catch (e: Exception) {
                cameraScanPromise?.resolve("")
            }
            cameraScanPromise = null
        }
    }

    override fun onNewIntent(intent: Intent?) {
        // No-op
    }

    override fun onHostResume() {
        registerScannerReceiver()
    }

    override fun onHostPause() {
        // Keep receiver active
    }

    override fun onHostDestroy() {
        unregisterScannerReceiver()
    }
}
