package com.vms_sunmi_app

import android.util.Log
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.vms_sunmi_app.sunmi.SunmiScannerModule

class MainActivity : ReactActivity() {

  private val scanBuffer = StringBuilder()
  private var lastKeyTime: Long = 0

  override fun getMainComponentName(): String = "vms_sunmi_app"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun dispatchKeyEvent(event: KeyEvent?): Boolean {
    if (event != null) {
      if (event.action == KeyEvent.ACTION_DOWN) {
        when (event.keyCode) {
          KeyEvent.KEYCODE_VOLUME_UP -> {
            Log.d("MainActivity", "Hardware Key: VOLUME_UP")
            emitHardwareKey("VOLUME_UP")
            return true
          }
          KeyEvent.KEYCODE_VOLUME_DOWN -> {
            Log.d("MainActivity", "Hardware Key: VOLUME_DOWN")
            emitHardwareKey("VOLUME_DOWN")
            return true
          }
          KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> {
            val scannedString = scanBuffer.toString().trim()
            scanBuffer.setLength(0)
            if (scannedString.isNotEmpty()) {
              Log.d("MainActivity", "Bluetooth/HID Scanner Scanned: $scannedString")
              emitScanResult(scannedString)
            }
            return true
          }
          else -> {
            val now = System.currentTimeMillis()
            if (now - lastKeyTime > 1200) {
              scanBuffer.setLength(0)
            }
            lastKeyTime = now

            val unicode = event.getUnicodeChar(event.metaState)
            if (unicode != 0) {
              val c = unicode.toChar()
              if (c != '\n' && c != '\r') {
                scanBuffer.append(c)
              }
            } else if (event.characters != null) {
              scanBuffer.append(event.characters)
            }
          }
        }
      } else if (event.action == KeyEvent.ACTION_UP) {
        when (event.keyCode) {
          KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_VOLUME_DOWN -> return true
          KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> {
            // Always consume enter key up so Android OS never triggers focused button onClick
            return true
          }
        }
      }
    }
    return super.dispatchKeyEvent(event)
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (event?.repeatCount == 0) {
      when (keyCode) {
        KeyEvent.KEYCODE_VOLUME_UP -> {
          Log.d("MainActivity", "onKeyDown: VOLUME_UP")
          emitHardwareKey("VOLUME_UP")
          return true
        }
        KeyEvent.KEYCODE_VOLUME_DOWN -> {
          Log.d("MainActivity", "onKeyDown: VOLUME_DOWN")
          emitHardwareKey("VOLUME_DOWN")
          return true
        }
      }
    }
    return super.onKeyDown(keyCode, event)
  }

  private fun emitHardwareKey(keyName: String) {
    try {
      Log.d("MainActivity", "Emitting keyName to React Native: $keyName")
      val ctx = reactNativeHost.reactInstanceManager.currentReactContext
        ?: SunmiScannerModule.reactAppContext
      ctx?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("onHardwareKeyPress", keyName)
      Log.d("MainActivity", "Emitted keyName successfully: $keyName")
    } catch (e: Exception) {
      Log.e("MainActivity", "Error emitting hardware key: ${e.message}", e)
    }
  }

  private fun emitScanResult(scannedCode: String) {
    try {
      Log.d("MainActivity", "Emitting scannedCode to React Native: $scannedCode")
      val ctx = reactNativeHost.reactInstanceManager.currentReactContext
        ?: SunmiScannerModule.reactAppContext
      ctx?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("onBarcodeScanned", scannedCode)
      Log.d("MainActivity", "Emitted scannedCode successfully: $scannedCode")
    } catch (e: Exception) {
      Log.e("MainActivity", "Error emitting scan result: ${e.message}", e)
    }
  }
}


