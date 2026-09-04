package com.vms_sunmi_app.sunmi

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.ServiceConnection
import android.graphics.Bitmap
import android.graphics.Color
import android.os.IBinder
import android.os.RemoteException
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import java.util.EnumMap
import woyou.aidlservice.jiuiv5.ICallback
import woyou.aidlservice.jiuiv5.IWoyouService

class SunmiPrinterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var woyouService: IWoyouService? = null
    private var isHardwareReady = true
    private var hardwareStatus = "NORMAL"
    private var hardwareMessage = "เครื่องพิมพ์พร้อมใช้งานปกติ"

    private val printerReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action ?: return
            when {
                action.contains("COVER_OPEN", ignoreCase = true) || action.contains("COVER_ERROR", ignoreCase = true) -> {
                    isHardwareReady = false
                    hardwareStatus = "COVER_OPEN"
                    hardwareMessage = "ฝาช่องใส่กระดาษเปิดอยู่ กรุณาปิดฝาให้สนิท"
                }
                action.contains("OUT_OF_PAPER", ignoreCase = true) -> {
                    isHardwareReady = false
                    hardwareStatus = "OUT_OF_PAPER"
                    hardwareMessage = "กระดาษพิมพ์หมด กรุณาใส่กระดาษม้วนใหม่ (58 มม.)"
                }
                action.contains("OVER_HEATING", ignoreCase = true) -> {
                    isHardwareReady = false
                    hardwareStatus = "OVERHEAT"
                    hardwareMessage = "หัวพิมพ์ร้อนเกินไป กรุณารอสักครู่"
                }
                action.contains("NORMAL", ignoreCase = true) || action.contains("INIT_ACTION", ignoreCase = true) -> {
                    isHardwareReady = true
                    hardwareStatus = "NORMAL"
                    hardwareMessage = "เครื่องพิมพ์พร้อมใช้งานปกติ"
                }
            }

            try {
                val params = Arguments.createMap().apply {
                    putBoolean("isReady", isHardwareReady)
                    putString("status", hardwareStatus)
                    putString("message", hardwareMessage)
                }
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("SunmiPrinterStatusChanged", params)
            } catch (e: Exception) {}
        }
    }

    private val connService = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            woyouService = IWoyouService.Stub.asInterface(service)
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            woyouService = null
        }
    }

    private val nullCallback = object : ICallback.Stub() {
        override fun onRunResult(isSuccess: Boolean) {}
        override fun onReturnString(result: String?) {}
        override fun onRaiseException(errorCode: Int, errorMessage: String?) {}
        override fun onPrintResult(code: Int, msg: String?) {}
    }

    init {
        bindPrinterService()
        registerPrinterReceiver()
    }

    private fun registerPrinterReceiver() {
        try {
            val filter = IntentFilter().apply {
                addAction("woyou.aidlservice.jiuv5.OUT_OF_PAPER_ACTION")
                addAction("woyou.aidlservice.jiuv5.OUT_OF_PAPER_ACTION_EN")
                addAction("woyou.aidlservice.jiuv5.COVER_OPEN_ACTION")
                addAction("woyou.aidlservice.jiuv5.COVER_OPEN_ACTION_EN")
                addAction("woyou.aidlservice.jiuv5.COVER_ERROR_ACTION")
                addAction("woyou.aidlservice.jiuv5.OVER_HEATING_ACITON")
                addAction("woyou.aidlservice.jiuv5.OVER_HEATING_ACITON_EN")
                addAction("woyou.aidlservice.jiuv5.NORMAL_ACTION")
                addAction("woyou.aidlservice.jiuv5.INIT_ACTION")
            }
            reactContext.registerReceiver(printerReceiver, filter)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun getName(): String {
        return "SunmiPrinter"
    }

    private fun bindPrinterService() {
        try {
            val intent = Intent()
            intent.`package` = "woyou.aidlservice.jiuiv5"
            intent.action = "woyou.aidlservice.jiuiv5.IWoyouService"
            reactContext.bindService(intent, connService, Context.BIND_AUTO_CREATE)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun generateQrBitmap(content: String, size: Int = 300): Bitmap? {
        try {
            val hints = EnumMap<EncodeHintType, Any>(EncodeHintType::class.java).apply {
                put(EncodeHintType.CHARACTER_SET, "UTF-8")
                put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M)
                put(EncodeHintType.MARGIN, 1)
            }
            val bitMatrix = MultiFormatWriter().encode(content, BarcodeFormat.QR_CODE, size, size, hints)
            val width = bitMatrix.width
            val height = bitMatrix.height
            val pixels = IntArray(width * height)
            for (y in 0 until height) {
                val offset = y * width
                for (x in 0 until width) {
                    pixels[offset + x] = if (bitMatrix.get(x, y)) Color.BLACK else Color.WHITE
                }
            }
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
            return bitmap
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    private fun generateBarcodeBitmap(content: String, width: Int = 340, height: Int = 80): Bitmap? {
        try {
            val hints = EnumMap<EncodeHintType, Any>(EncodeHintType::class.java).apply {
                put(EncodeHintType.CHARACTER_SET, "UTF-8")
                put(EncodeHintType.MARGIN, 0)
            }
            val bitMatrix = MultiFormatWriter().encode(content, BarcodeFormat.CODE_128, width, height, hints)
            val w = bitMatrix.width
            val h = bitMatrix.height
            val pixels = IntArray(w * h)
            for (y in 0 until h) {
                val offset = y * w
                for (x in 0 until w) {
                    pixels[offset + x] = if (bitMatrix.get(x, y)) Color.BLACK else Color.WHITE
                }
            }
            val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            bitmap.setPixels(pixels, 0, w, 0, 0, w, h)
            return bitmap
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    @ReactMethod
    fun isConnected(promise: Promise) {
        promise.resolve(woyouService != null)
    }

    private fun checkPrinterHardwareStatusSync(): Triple<Boolean, String, String> {
        val service = woyouService ?: return Triple(false, "DISCONNECTED", "ไม่ได้เชื่อมต่อกับเครื่องพิมพ์ Sunmi")
        
        // Prioritize hardware sensor event from system broadcast receiver
        if (!isHardwareReady) {
            return Triple(false, hardwareStatus, hardwareMessage)
        }

        var stateCode = 1
        try {
            stateCode = service.updatePrinterState()
        } catch (e: Exception) {
            stateCode = 1
        }

        return when (stateCode) {
            1, 0 -> Triple(true, "NORMAL", "เครื่องพิมพ์พร้อมใช้งานปกติ")
            2 -> Triple(false, "UPDATING", "เครื่องพิมพ์กำลังอัปเดตสถานะ")
            3, 505 -> {
                isHardwareReady = false
                hardwareStatus = "OUT_OF_PAPER"
                hardwareMessage = "กระดาษพิมพ์หมด กรุณาใส่กระดาษม้วนใหม่ (58 มม.)"
                Triple(false, "OUT_OF_PAPER", hardwareMessage)
            }
            4 -> {
                isHardwareReady = false
                hardwareStatus = "OVERHEAT"
                hardwareMessage = "หัวพิมพ์ร้อนเกินไป กรุณารอสักครู่"
                Triple(false, "OVERHEAT", hardwareMessage)
            }
            507 -> {
                isHardwareReady = false
                hardwareStatus = "COVER_OPEN"
                hardwareMessage = "ฝาช่องใส่กระดาษเปิดอยู่ กรุณาปิดฝาให้สนิท"
                Triple(false, "COVER_OPEN", hardwareMessage)
            }
            else -> {
                Triple(false, "ERROR", "เครื่องพิมพ์ไม่พร้อมทำงาน (รหัสสถานะ: $stateCode)")
            }
        }
    }

    @ReactMethod
    fun getPrinterStatus(promise: Promise) {
        val service = woyouService
        if (service == null) {
            val result = Arguments.createMap().apply {
                putBoolean("isConnected", false)
                putString("status", "DISCONNECTED")
                putInt("code", -1)
                putString("message", "ไม่ได้เชื่อมต่อกับเครื่องพิมพ์ Sunmi")
            }
            promise.resolve(result)
            return
        }

        val (isReady, status, message) = checkPrinterHardwareStatusSync()
        val result = Arguments.createMap().apply {
            putBoolean("isConnected", true)
            putBoolean("isReady", isReady)
            putString("status", status)
            putInt("code", if (isReady) 1 else if (status == "COVER_OPEN") 507 else if (status == "OUT_OF_PAPER") 505 else 0)
            putString("message", message)
        }
        promise.resolve(result)
    }

    @ReactMethod
    fun printerInit(promise: Promise) {
        val service = woyouService
        if (service == null) {
            bindPrinterService()
            promise.resolve(false)
            return
        }
        try {
            service.printerInit(nullCallback)
            promise.resolve(true)
        } catch (e: RemoteException) {
            promise.reject("PRINT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun printText(text: String, align: Int, fontSize: Float, isBold: Boolean, isUnderline: Boolean, promise: Promise) {
        val service = woyouService
        if (service == null) {
            promise.reject("SERVICE_UNAVAILABLE", "Sunmi Printer Service not connected")
            return
        }
        try {
            service.setAlignment(align, nullCallback)
            val size = if (fontSize > 0) fontSize else 24f
            
            // Bold ESC/POS command if requested
            if (isBold) {
                try {
                    service.sendRAWData(byteArrayOf(0x1B, 0x45, 0x01), nullCallback)
                    service.sendRAWData(byteArrayOf(0x1B, 0x47, 0x01), nullCallback)
                } catch (e: Exception) {}
            } else {
                try {
                    service.sendRAWData(byteArrayOf(0x1B, 0x45, 0x00), nullCallback)
                    service.sendRAWData(byteArrayOf(0x1B, 0x47, 0x00), nullCallback)
                } catch (e: Exception) {}
            }

            service.printTextWithFont(text, "", size, nullCallback)
            promise.resolve(true)
        } catch (e: RemoteException) {
            promise.reject("PRINT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun printQRCode(data: String, moduleSize: Int, errorLevel: Int, promise: Promise) {
        val service = woyouService
        if (service == null) {
            promise.reject("SERVICE_UNAVAILABLE", "Sunmi Printer Service not connected")
            return
        }
        try {
            val qrBitmap = generateQrBitmap(data, 300)
            service.setAlignment(1, nullCallback)
            if (qrBitmap != null) {
                service.printBitmap(qrBitmap, nullCallback)
            } else {
                service.printQRCode(data, if (moduleSize in 1..16) moduleSize else 8, if (errorLevel in 0..3) errorLevel else 2, nullCallback)
            }
            service.lineWrap(1, nullCallback)
            promise.resolve(true)
        } catch (e: RemoteException) {
            promise.reject("PRINT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun printBarCode(data: String, symbology: Int, height: Int, width: Int, textPosition: Int, promise: Promise) {
        val service = woyouService
        if (service == null) {
            promise.reject("SERVICE_UNAVAILABLE", "Sunmi Printer Service not connected")
            return
        }
        try {
            val barcodeBitmap = generateBarcodeBitmap(data, 340, if (height > 0) height else 80)
            service.setAlignment(1, nullCallback)
            if (barcodeBitmap != null) {
                service.printBitmap(barcodeBitmap, nullCallback)
            } else {
                service.printBarCode(data, symbology, if (height > 0) height else 120, if (width in 2..6) width else 2, textPosition, nullCallback)
            }
            service.lineWrap(1, nullCallback)
            promise.resolve(true)
        } catch (e: RemoteException) {
            promise.reject("PRINT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun lineWrap(n: Int, promise: Promise) {
        val service = woyouService
        if (service == null) {
            promise.resolve(false)
            return
        }
        try {
            service.lineWrap(if (n > 0) n else 1, nullCallback)
            promise.resolve(true)
        } catch (e: RemoteException) {
            promise.reject("PRINT_ERROR", e.message)
        }
    }

    /**
     * Fast All-in-One Visitor Slip Printer
     * Direct byte-level print formatted for 58mm Sunmi thermal rolls
     * Exact 1:1 format matching Picture 2 (pwa_innerprint_android) with enhanced bold contrast and guaranteed QR
     */
    @ReactMethod
    fun printVisitorSlip(slipData: ReadableMap, promise: Promise) {
        val service = woyouService
        if (service == null) {
            val result = Arguments.createMap().apply {
                putBoolean("success", false)
                putString("status", "DISCONNECTED")
                putString("message", "ไม่ได้เชื่อมต่อกับเครื่องพิมพ์ Sunmi")
            }
            promise.resolve(result)
            return
        }

        try {
            // 1. Check hardware status FIRST (Cover open, Out of paper)
            val (isReady, initialStatus, initialMsg) = checkPrinterHardwareStatusSync()
            if (!isReady) {
                val result = Arguments.createMap().apply {
                    putBoolean("success", false)
                    putString("status", initialStatus)
                    putString("message", initialMsg)
                }
                promise.resolve(result)
                return
            }

            val villageName = if (slipData.hasKey("villageName")) slipData.getString("villageName") ?: "" else ""
            val serviceName = if (slipData.hasKey("serviceName")) slipData.getString("serviceName") ?: villageName else villageName
            val guardhouse = if (slipData.hasKey("guardhouse")) slipData.getString("guardhouse") ?: "" else ""
            val reason = if (slipData.hasKey("reason")) slipData.getString("reason") ?: "-" else "-"
            val houseNo = if (slipData.hasKey("houseNo")) slipData.getString("houseNo") ?: "-" else "-"
            val licensePlate = if (slipData.hasKey("licensePlate")) slipData.getString("licensePlate") ?: "-" else "-"
            val visitorName = if (slipData.hasKey("visitorName")) slipData.getString("visitorName") ?: "-" else "-"
            val passId = if (slipData.hasKey("passId")) slipData.getString("passId") ?: "-" else "-"
            val dateStr = if (slipData.hasKey("dateStr")) slipData.getString("dateStr") ?: "" else ""
            val timeStr = if (slipData.hasKey("timeStr")) slipData.getString("timeStr") ?: "" else ""
            val issuedAtStr = if (timeStr.isNotEmpty()) "$dateStr $timeStr".trim() else dateStr
            val qrPayload = if (slipData.hasKey("qrPayload")) slipData.getString("qrPayload") ?: "" else ""
            val legacyQrPayload = if (slipData.hasKey("legacyQrPayload")) slipData.getString("legacyQrPayload") ?: "" else ""
            val barcodePayload = if (slipData.hasKey("barcodePayload")) slipData.getString("barcodePayload") ?: "" else ""

            // Ensure QR payload is NEVER empty
            val qrToPrint = when {
                qrPayload.isNotBlank() && qrPayload != "-" -> qrPayload
                legacyQrPayload.isNotBlank() && legacyQrPayload != "-" -> legacyQrPayload
                barcodePayload.isNotBlank() && barcodePayload != "-" -> barcodePayload
                passId.isNotBlank() && passId != "-" -> "pass_exchange?id=$passId"
                else -> "pass_exchange?id=VMS-${System.currentTimeMillis()}"
            }

            service.printerInit(nullCallback)

            fun setBold(enabled: Boolean) {
                try {
                    // ESC E (Bold) + ESC G (Double-strike for ultra-dark print)
                    val mode = if (enabled) 0x01.toByte() else 0x00.toByte()
                    service.sendRAWData(byteArrayOf(0x1B, 0x45, mode), nullCallback)
                    service.sendRAWData(byteArrayOf(0x1B, 0x47, mode), nullCallback)
                } catch (e: Exception) {}
            }

            fun printLine(text: String, size: Float = 27f) {
                try {
                    service.setFontSize(size, nullCallback)
                    service.printTextWithFont(text, "", size, nullCallback)
                } catch (e: Exception) {}
            }

            // 1. Header (Centered, Bold)
            service.setAlignment(1, nullCallback)
            setBold(true)
            printLine("VMS VISITOR PASS\n", 34f)
            if (serviceName.isNotEmpty()) {
                printLine("$serviceName\n", 26f)
            }
            if (guardhouse.isNotEmpty() && guardhouse != "-") {
                printLine("$guardhouse\n", 26f)
            }
            setBold(false)
            service.lineWrap(1, nullCallback)

            // 2. Info Body (Left aligned, Dark Bold 27f)
            service.setAlignment(0, nullCallback)
            setBold(true)
            printLine("เลขบัตร: $passId\n", 27f)
            printLine("ผู้ติดต่อ: $visitorName\n", 27f)
            printLine("บ้านเลขที่: $houseNo\n", 27f)
            printLine("ทะเบียน: $licensePlate\n", 27f)
            printLine("เหตุผล: $reason\n", 27f)
            if (issuedAtStr.isNotEmpty()) {
                printLine("เวลาออกบัตร: $issuedAtStr\n", 27f)
            }
            setBold(false)
            service.lineWrap(1, nullCallback)

            // 3. QR Code (Centered, Direct Crisp Bitmap via ZXing)
            service.setAlignment(1, nullCallback)
            val qrBitmap = generateQrBitmap(qrToPrint, 300)
            if (qrBitmap != null) {
                service.printBitmap(qrBitmap, nullCallback)
            } else {
                service.printQRCode(qrToPrint, 8, 2, nullCallback)
            }
            service.lineWrap(1, nullCallback)

            // 4. Barcode (Code 128 under QR Code with same data / token)
            val barcodeText = when {
                barcodePayload.isNotBlank() && barcodePayload != "-" -> barcodePayload
                passId.isNotBlank() && passId != "-" -> passId
                else -> qrToPrint
            }
            val cleanBarcode = barcodeText.filter { it.code in 32..126 }.ifBlank { barcodeText }

            if (cleanBarcode.isNotBlank()) {
                try {
                    val barcodeBitmap = generateBarcodeBitmap(cleanBarcode, 360, 80)
                    if (barcodeBitmap != null) {
                        service.setAlignment(1, nullCallback)
                        service.printBitmap(barcodeBitmap, nullCallback)
                    } else {
                        service.printBarCode(cleanBarcode, 8, 84, 3, 2, nullCallback)
                    }
                    service.lineWrap(1, nullCallback)
                    setBold(true)
                    printLine("$cleanBarcode\n", 25f)
                    setBold(false)
                    service.lineWrap(1, nullCallback)
                } catch (e: Exception) {}
            }

            // 5. Footer (3-Language Exit Instructions, Bold 23f)
            service.setAlignment(1, nullCallback)
            setBold(true)
            printLine("กรุณานำบัตรนี้ไปสแกนที่บริเวณทางออก\n", 23f)
            printLine("Please scan this pass at the exit.\n", 23f)
            printLine("请在出口处扫描此通行证\n", 23f)
            service.lineWrap(1, nullCallback)
            printLine("เป็นบัตรผ่านใช้งานได้ครั้งเดียว ไม่สามารถนำมาใช้ซ้ำได้\n", 23f)
            printLine("This pass is valid for one-time use only and cannot be reused.\n", 23f)
            printLine("此通行证仅限使用一次，不可重复使用\n", 23f)
            setBold(false)

            // 6. Complete print with Completion Callback & Latch
            val printLatch = java.util.concurrent.CountDownLatch(1)
            var printSuccess = true
            var printStatus = "SUCCESS"
            var printMsg = "พิมพ์สลิปสำเร็จ"

            val finalCallback = object : ICallback.Stub() {
                override fun onRunResult(isSuccess: Boolean) {
                    if (!isSuccess) {
                        printSuccess = false
                        if (printStatus == "SUCCESS") {
                            printStatus = "ERROR"
                            printMsg = "เครื่องพิมพ์ปฏิเสธการพิมพ์ (อาจเปิดฝาหรือกระดาษหมด)"
                        }
                    }
                    printLatch.countDown()
                }

                override fun onReturnString(result: String?) {
                    printLatch.countDown()
                }

                override fun onRaiseException(errorCode: Int, errorMessage: String?) {
                    printSuccess = false
                    val msg = errorMessage ?: ""
                    when {
                        errorCode == 507 || msg.contains("open", ignoreCase = true) || msg.contains("盖") || msg.contains("ฝา") -> {
                            printStatus = "COVER_OPEN"
                            printMsg = "ฝาช่องใส่กระดาษเปิดอยู่ กรุณาปิดฝาให้สนิท"
                        }
                        errorCode == 3 || errorCode == 505 || msg.contains("paper", ignoreCase = true) || msg.contains("纸") || msg.contains("กระดาษ") -> {
                            printStatus = "OUT_OF_PAPER"
                            printMsg = "กระดาษพิมพ์หมด กรุณาใส่กระดาษม้วนใหม่ (58 มม.)"
                        }
                        else -> {
                            printStatus = "ERROR"
                            printMsg = if (msg.isNotBlank()) msg else "เกิดข้อผิดพลาดในการพิมพ์ ($errorCode)"
                        }
                    }
                    printLatch.countDown()
                }

                override fun onPrintResult(code: Int, msg: String?) {
                    if (code == 507) {
                        printSuccess = false
                        printStatus = "COVER_OPEN"
                        printMsg = "ฝาช่องใส่กระดาษเปิดอยู่ กรุณาปิดฝาให้สนิท"
                    } else if (code == 3 || code == 505) {
                        printSuccess = false
                        printStatus = "OUT_OF_PAPER"
                        printMsg = "กระดาษพิมพ์หมด กรุณาใส่กระดาษม้วนใหม่ (58 มม.)"
                    } else if (code != 0 && code != 1 && code != 5) {
                        printSuccess = false
                        printStatus = "ERROR"
                        printMsg = msg ?: "พิมพ์ไม่สำเร็จ"
                    }
                    printLatch.countDown()
                }
            }

            service.lineWrap(4, finalCallback)
            printLatch.await(1500, java.util.concurrent.TimeUnit.MILLISECONDS)

            if (!printSuccess) {
                val result = Arguments.createMap().apply {
                    putBoolean("success", false)
                    putString("status", printStatus)
                    putString("message", printMsg)
                }
                promise.resolve(result)
                return
            }

            val result = Arguments.createMap().apply {
                putBoolean("success", true)
                putString("status", "SUCCESS")
                putString("message", "พิมพ์สลิปสำเร็จ")
            }
            promise.resolve(result)
        } catch (e: Exception) {
            val msg = e.message ?: ""
            val isPaperOut = msg.contains("paper", ignoreCase = true) || msg.contains("缺纸") || msg.contains("out_of_paper", ignoreCase = true)
            val isCoverOpen = msg.contains("open", ignoreCase = true) || msg.contains("开盖") || msg.contains("cover", ignoreCase = true)
            val result = Arguments.createMap().apply {
                putBoolean("success", false)
                putString("status", if (isCoverOpen) "COVER_OPEN" else if (isPaperOut) "OUT_OF_PAPER" else "ERROR")
                putString("message", if (isCoverOpen) "ฝาช่องใส่กระดาษเปิดอยู่ กรุณาปิดฝาให้สนิท" else if (isPaperOut) "กระดาษพิมพ์หมด กรุณาใส่กระดาษม้วนใหม่" else msg)
            }
            promise.resolve(result)
        }
    }
}
