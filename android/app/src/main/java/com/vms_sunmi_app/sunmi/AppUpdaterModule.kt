package com.vms_sunmi_app.sunmi

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.vms_sunmi_app.BuildConfig
import java.io.File

class AppUpdaterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppUpdater"

    @ReactMethod
    fun getInstalledVersion(promise: Promise) {
        val result = Arguments.createMap().apply {
            putInt("versionCode", BuildConfig.VERSION_CODE)
            putString("versionName", BuildConfig.VERSION_NAME)
            putString("applicationId", BuildConfig.APPLICATION_ID)
        }
        promise.resolve(result)
    }

    @ReactMethod
    fun canInstallUnknownApps(promise: Promise) {
        val canInstall = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
        promise.resolve(canInstall)
    }

    @ReactMethod
    fun openUnknownAppsSettings(promise: Promise) {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${reactContext.packageName}")
                )
            } else {
                Intent(Settings.ACTION_SECURITY_SETTINGS)
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_SETTINGS_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun downloadAndInstallApk(apkUrl: String, fileName: String, promise: Promise) {
        if (apkUrl.isBlank()) {
            promise.reject("APK_URL_REQUIRED", "APK URL is required")
            return
        }

        Thread {
            try {
                val safeFileName = sanitizeFileName(fileName.ifBlank { "vmp-update.apk" })
                val downloadDir = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                    ?: reactContext.cacheDir
                val apkFile = File(downloadDir, safeFileName)
                if (apkFile.exists()) apkFile.delete()

                val request = DownloadManager.Request(Uri.parse(apkUrl))
                    .setTitle("VMP Update")
                    .setDescription("Downloading VMP update package")
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(true)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationUri(Uri.fromFile(apkFile))

                val downloadManager = reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                val downloadId = downloadManager.enqueue(request)
                val completedFile = waitForDownload(downloadManager, downloadId, apkFile)

                installApk(completedFile)

                val result = Arguments.createMap().apply {
                    putString("filePath", completedFile.absolutePath)
                    putString("message", "เปิดหน้าติดตั้ง APK แล้ว")
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("APK_UPDATE_FAILED", e.message, e)
            }
        }.start()
    }

    private fun waitForDownload(downloadManager: DownloadManager, downloadId: Long, fallbackFile: File): File {
        val query = DownloadManager.Query().setFilterById(downloadId)
        val startedAt = System.currentTimeMillis()
        val timeoutMs = 10 * 60 * 1000L

        while (System.currentTimeMillis() - startedAt < timeoutMs) {
            downloadManager.query(query).use { cursor ->
                if (cursor != null && cursor.moveToFirst()) {
                    val statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                    val reasonIndex = cursor.getColumnIndex(DownloadManager.COLUMN_REASON)
                    val localUriIndex = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI)
                    val status = cursor.getInt(statusIndex)

                    when (status) {
                        DownloadManager.STATUS_SUCCESSFUL -> {
                            val localUri = cursor.getString(localUriIndex)
                            return localUri?.let { File(Uri.parse(it).path ?: fallbackFile.absolutePath) }
                                ?: fallbackFile
                        }
                        DownloadManager.STATUS_FAILED -> {
                            val reason = if (reasonIndex >= 0) cursor.getInt(reasonIndex) else -1
                            throw IllegalStateException("ดาวน์โหลด APK ไม่สำเร็จ (reason: $reason)")
                        }
                    }
                }
            }
            Thread.sleep(600)
        }

        throw IllegalStateException("ดาวน์โหลด APK ใช้เวลานานเกินไป")
    }

    private fun installApk(apkFile: File) {
        if (!apkFile.exists()) {
            throw IllegalStateException("ไม่พบไฟล์ APK ที่ดาวน์โหลด")
        }

        val apkUri = FileProvider.getUriForFile(
            reactContext,
            "${BuildConfig.APPLICATION_ID}.fileprovider",
            apkFile
        )

        val installIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        reactContext.startActivity(installIntent)
    }

    private fun sanitizeFileName(value: String): String {
        val cleaned = value.replace(Regex("[^A-Za-z0-9._-]"), "_")
        return if (cleaned.endsWith(".apk", ignoreCase = true)) cleaned else "$cleaned.apk"
    }
}
