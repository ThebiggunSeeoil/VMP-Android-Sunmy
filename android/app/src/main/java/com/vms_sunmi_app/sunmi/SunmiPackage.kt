package com.vms_sunmi_app.sunmi

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager
import com.vms_sunmi_app.camera.CameraScannerViewManager
import com.vms_sunmi_app.bluetooth.BluetoothSppScannerModule

class SunmiPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            SunmiPrinterModule(reactContext),
            SunmiScannerModule(reactContext),
            BluetoothSppScannerModule(reactContext),
            AppUpdaterModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(
            CameraScannerViewManager()
        )
    }
}
