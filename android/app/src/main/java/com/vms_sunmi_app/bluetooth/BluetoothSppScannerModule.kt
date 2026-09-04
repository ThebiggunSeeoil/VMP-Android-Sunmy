package com.vms_sunmi_app.bluetooth

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.IOException
import java.io.InputStream
import java.util.*
import java.util.concurrent.atomic.AtomicBoolean

class BluetoothSppScannerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    companion object {
        const val NAME = "BluetoothSppScanner"
        val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        private const val TAG = "BluetoothSppScanner"
    }

    private val bluetoothAdapter: BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()
    private var connectedSocket: BluetoothSocket? = null
    private var connectedDevice: BluetoothDevice? = null
    private var readThread: Thread? = null
    private val isRunning = AtomicBoolean(false)
    private var lastConnectedAddress: String? = null

    init {
        reactContext.addLifecycleEventListener(this)
        registerBluetoothStateReceiver()
    }

    override fun getName(): String = NAME

    private fun sendEvent(eventName: String, params: Any?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
        }
    }

    @ReactMethod
    fun getPairedDevices(promise: Promise) {
        try {
            if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) {
                promise.resolve(Arguments.createArray())
                return
            }
            val paired = bluetoothAdapter.bondedDevices
            val array = Arguments.createArray()
            for (device in paired) {
                val map = Arguments.createMap()
                map.putString("name", device.name ?: "Unknown Device")
                map.putString("address", device.address)
                map.putInt("type", device.type)
                array.pushMap(map)
            }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("ERR_GET_PAIRED", e.message, e)
        }
    }

    @ReactMethod
    fun isConnected(promise: Promise) {
        val connected = connectedSocket?.isConnected == true
        val map = Arguments.createMap()
        map.putBoolean("connected", connected)
        map.putString("deviceName", connectedDevice?.name)
        map.putString("address", connectedDevice?.address)
        promise.resolve(map)
    }

    @ReactMethod
    fun connect(address: String, promise: Promise) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) {
            promise.reject("ERR_BT_DISABLED", "Bluetooth is disabled")
            return
        }

        Thread {
            try {
                disconnectInternal()

                val device = bluetoothAdapter.getRemoteDevice(address)
                Log.d(TAG, "Connecting to SPP Device: ${device.name} (${device.address})")

                bluetoothAdapter.cancelDiscovery()

                var socket: BluetoothSocket? = null
                try {
                    socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                    socket.connect()
                } catch (e: Exception) {
                    Log.w(TAG, "Standard SPP connection failed, trying fallback reflection: ${e.message}")
                    val m = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
                    socket = m.invoke(device, 1) as BluetoothSocket
                    socket.connect()
                }

                if (socket?.isConnected == true) {
                    connectedSocket = socket
                    connectedDevice = device
                    lastConnectedAddress = address
                    startReading(socket.inputStream)

                    val map = Arguments.createMap()
                    map.putBoolean("connected", true)
                    map.putString("deviceName", device.name)
                    map.putString("address", device.address)
                    sendEvent("onBluetoothStatusChange", map)

                    promise.resolve(map)
                } else {
                    promise.reject("ERR_CONNECT_FAILED", "Could not connect to device")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Connection failed: ${e.message}", e)
                disconnectInternal()
                promise.reject("ERR_CONNECT_FAILED", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        disconnectInternal()
        val map = Arguments.createMap()
        map.putBoolean("connected", false)
        sendEvent("onBluetoothStatusChange", map)
        promise.resolve(true)
    }

    private fun disconnectInternal() {
        isRunning.set(false)
        try {
            readThread?.interrupt()
            readThread = null
        } catch (e: Exception) {}

        try {
            connectedSocket?.close()
        } catch (e: Exception) {}
        connectedSocket = null
        connectedDevice = null
    }

    private fun startReading(inputStream: InputStream) {
        isRunning.set(true)
        readThread = Thread {
            val buffer = ByteArray(1024)
            val lineBuffer = StringBuilder()

            while (isRunning.get() && connectedSocket?.isConnected == true) {
                try {
                    val bytesRead = inputStream.read(buffer)
                    if (bytesRead > 0) {
                        for (i in 0 until bytesRead) {
                            val c = buffer[i].toInt().toChar()
                            if (c == '\n' || c == '\r') {
                                if (lineBuffer.isNotEmpty()) {
                                    val scannedCode = lineBuffer.toString().trim()
                                    lineBuffer.setLength(0)
                                    if (scannedCode.isNotEmpty()) {
                                        Log.d(TAG, "SPP Barcode Received: $scannedCode")
                                        sendEvent("onBarcodeScanned", scannedCode)
                                        sendEvent("onBluetoothSppScanned", scannedCode)
                                    }
                                }
                            } else {
                                lineBuffer.append(c)
                            }
                        }
                    }
                } catch (e: IOException) {
                    Log.w(TAG, "Read thread disconnected: ${e.message}")
                    break
                }
            }

            if (isRunning.get()) {
                disconnectInternal()
                val map = Arguments.createMap()
                map.putBoolean("connected", false)
                sendEvent("onBluetoothStatusChange", map)
            }
        }.apply {
            name = "BluetoothSPPReader"
            start()
        }
    }

    private val bluetoothReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action ?: return
            if (action == BluetoothDevice.ACTION_ACL_DISCONNECTED) {
                val device: BluetoothDevice? = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                if (device?.address == connectedDevice?.address) {
                    Log.d(TAG, "ACL Disconnected for ${device?.name}")
                    disconnectInternal()
                    val map = Arguments.createMap()
                    map.putBoolean("connected", false)
                    sendEvent("onBluetoothStatusChange", map)
                }
            }
        }
    }

    private fun registerBluetoothStateReceiver() {
        val filter = IntentFilter().apply {
            addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
            addAction(BluetoothAdapter.ACTION_STATE_CHANGED)
        }
        try {
            reactContext.registerReceiver(bluetoothReceiver, filter)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun addListener(eventName: String?) {}

    @ReactMethod
    fun removeListeners(count: Int?) {}

    override fun onHostResume() {}
    override fun onHostPause() {}
    override fun onHostDestroy() {
        disconnectInternal()
        try {
            reactContext.unregisterReceiver(bluetoothReceiver)
        } catch (e: Exception) {}
    }
}
