// Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
package com.dcsf.bms

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.view.WindowManager
import android.view.WindowInsetsController
import android.os.Bundle
import android.util.Log
import android.webkit.WebView
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.os.Environment
import android.content.SharedPreferences
import com.journeyapps.barcodescanner.DecoratedBarcodeView
import com.journeyapps.barcodescanner.DefaultDecoderFactory
import com.google.zxing.BarcodeFormat
import androidx.compose.ui.draw.clip
import java.io.File
import java.io.FileOutputStream

import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.BluetoothConnected
import androidx.compose.material.icons.filled.BluetoothDisabled
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.res.stringResource
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.windowInsetsPadding
import android.view.View
import android.view.ViewTreeObserver
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.BatteryChargingFull
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.foundation.border
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.unit.Velocity
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

// Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.

data class AppColors(
    val bg: Color,
    val surface: Color,
    val surfaceConn: Color,
    val surfaceConnBorder: Color,
    val fg: Color,
    val fg2: Color,
    val fg3: Color,
    val border: Color,
    val primary: Color,
    val primaryFg: Color,
    val track: Color,
    val navBg: Color,
    val danger: Color,
    val swipeBg: Color,
) {
    companion object {
        // Colors synced with ui/src/styles/themes/light.css
        val Light = AppColors(
            bg = Color(0xFFF3F5F9),
            surface = Color(0xFFFFFFFF),
            surfaceConn = Color(0xFFECFDF5),
            surfaceConnBorder = Color(0xFFA7F3D0),
            fg = Color(0xFF11161F),
            fg2 = Color(0xFF5D646F),
            fg3 = Color(0xFF9CA3AF),
            border = Color(0xFFDCDEE1),
            primary = Color(0xFF0072D5),
            primaryFg = Color.White,
            track = Color(0xFFDCDEE1),
            navBg = Color.White,
            danger = Color(0xFFEF4444),
            swipeBg = Color(0xFFEF4444),
        )
        // Colors synced with ui/src/styles/themes/dark.css
        val Dark = AppColors(
            bg = Color(0xFF060709),
            surface = Color(0xFF13161B),
            surfaceConn = Color(0xFF0D2818),
            surfaceConnBorder = Color(0xFF166534),
            fg = Color(0xFFE4E8EF),
            fg2 = Color(0xFF88909C),
            fg3 = Color(0xFF6B7280),
            border = Color(0xFF26292E),
            primary = Color(0xFF4BA3F7),
            primaryFg = Color.White,
            track = Color(0xFF26292E),
            navBg = Color(0xFF13161B),
            danger = Color(0xFFF87171),
            swipeBg = Color(0xFFDC2626),
        )
    }
}

fun hasBlePermissions(context: Context): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
    } else {
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }
}

private var pushLogCounter = 0

fun pushToUi(webView: MutableState<WebView?>, type: String, payloadJson: String) {
    val wv = webView.value ?: return
    try {
        val escapedType = type.replace("'", "\\'")
        val js = "try{if(window.__APP_BRIDGE__){if(window.__APP_BRIDGE__._handler){window.__APP_BRIDGE__._handler({type:'" + escapedType + "',payload:" + payloadJson + "})}else{console.log('BRIDGE:_handler_not_set for " + escapedType + "')}}else{console.log('BRIDGE:__APP_BRIDGE__ not found')}}catch(e){console.log('BRIDGE:push_error:'+e.message)}"
        wv.post { wv.evaluateJavascript(js, null) }
    } catch (e: Exception) {

    }
}

class MainActivity : ComponentActivity() {
    private val bleManager = BleManager()
    private var mainWebView: WebView? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        val allGranted = perms.all { it.value }
        if (allGranted) bleManager.startScan(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        bleManager.initPrefs(this)
        // Enable edge-to-edge: content draws behind status bar, eliminating white gap
        window.setDecorFitsSystemWindows(false)
        setContent {
            val darkTheme = isSystemInDarkTheme()
            val c = if (darkTheme) AppColors.Dark else AppColors.Light

            val view = LocalContext.current
            val activity = view as? ComponentActivity
            LaunchedEffect(darkTheme) {
                activity?.window?.statusBarColor = c.bg.toArgb()
                activity?.window?.navigationBarColor = c.navBg.toArgb()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val controller = activity?.window?.insetsController
                    if (controller != null) {
                        controller.setSystemBarsAppearance(
                            if (!darkTheme) android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS else 0,
                            android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        )
                        controller.setSystemBarsAppearance(
                            if (!darkTheme) android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS else 0,
                            android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                        )
                    }
                } else {
                    val decorView = activity?.window?.decorView
                    var flags = decorView?.systemUiVisibility ?: 0
                    if (!darkTheme) {
                        flags = flags or android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            flags = flags or android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                        }
                    } else {
                        flags = flags and android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            flags = flags and android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
                        }
                    }
                    decorView?.systemUiVisibility = flags
                }
            }

            MaterialTheme(
                colorScheme = if (darkTheme) darkColorScheme(
                    primary = c.primary,
                    onPrimary = c.primaryFg,
                    surface = c.bg,
                    onSurface = c.fg,
                    background = c.bg,
                    onBackground = c.fg,
                ) else lightColorScheme(
                    primary = c.primary,
                    onPrimary = c.primaryFg,
                    surface = c.bg,
                    onSurface = c.fg,
                    background = c.bg,
                    onBackground = c.fg,
                )
            ) {
                BmsApp(
                    bleManager = bleManager,
                    colors = c,
                    darkTheme = darkTheme,
                    onRequestPermissions = { requestPermissions() },
                    onConnectDevice = { device -> connectDevice(device) },
                    onDisconnect = { disconnect() },
                    onWebViewCreated = { wv -> mainWebView = wv },
                )
            }
        }
    }

    private fun requestPermissions() {
        val perms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
            )
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        permissionLauncher.launch(perms)
    }

    private fun connectDevice(device: BleDevice) {
        bleManager.stopScan()

        try {
            bleManager.connect(this, device) { connected ->
                runOnUiThread {
                    bleManager.connected.value = connected
                    if (!connected) bleManager.connectionError.value = true
                    Log.d("BMS_BLE", if (connected) "Connected OK" else "Connection failed")
                }
            }
        } catch (e: Exception) {
            bleManager.connectingDevice.value = null

            Log.e("BMS_BLE", "connectDevice crash", e)
        }
    }

    private fun disconnect() {

        bleManager.disconnect()
    }

    override fun onDestroy() {
        super.onDestroy()
        bleManager.stopScan()
        bleManager.disconnect()
    }

    override fun onResume() {
        super.onResume()
        val status = if (bleManager.connected.value) "connected" else "disconnected"

        mainWebView?.let { wv ->
            wv.post {
                val js = "try{if(window.__APP_BRIDGE__){if(window.__APP_BRIDGE__._handler){window.__APP_BRIDGE__._handler({type:'bms:connection-status',payload:{\"status\":\"$status\"}})}else{console.log('BRIDGE:_handler_not_set for bms:connection-status')}}else{console.log('BRIDGE:__APP_BRIDGE__ not found')}}catch(e){console.log('BRIDGE:push_error:'+e.message)}"
                wv.evaluateJavascript(js, null)
            }
        }
    }
}

data class BleDevice(
    val name: String,
    val address: String,
    val rssi: Int,
    val soc: Int = 0,
    val voltage: Int = 0,
    val current: Int = 0,
    val safety: Int = 0,
    val lastSeen: Long = System.currentTimeMillis(),
) {
    fun voltageV(): Float = voltage / 100f
    fun currentA(): Float = current / 100f
}

object SafetyBits {
    const val CUV = 0; const val OCD = 1; const val SCD = 2; const val DSG_OT = 3
    const val RCA = 4; const val DSG_UT = 5; const val COV = 8; const val OCC = 9
    const val CHG_OT = 10; const val CHG_UT = 11; const val MOS_OT = 12
    const val COM_OUT = 13; const val P_DSG = 14; const val ALERT = 15

    private val NAMES = mapOf(
        CUV to "CUV", OCD to "OCD", SCD to "SCD", DSG_OT to "DSG_OT",
        RCA to "RCA", DSG_UT to "DSG_UT", COV to "COV", OCC to "OCC",
        CHG_OT to "CHG_OT", CHG_UT to "CHG_UT", MOS_OT to "MOS_OT",
        COM_OUT to "COM_OUT", P_DSG to "P_DSG", ALERT to "ALERT",
    )

    fun activeFlags(safety: Int): List<String> {
        val flags = mutableListOf<String>()
        for (i in 0..15) {
            if ((safety shr i) and 1 == 1) {
                NAMES[i]?.let { flags.add(it) }
            }
        }
        return flags
    }
}

@Suppress("DEPRECATION")
fun getScanRecordBytes(record: android.bluetooth.le.ScanRecord): ByteArray? = record.getBytes()

fun parseMfgData(data: ByteArray): IntArray? {
    Log.d("BMS_BLE", "parseMfgData: ${data.size} bytes: ${data.joinToString("") { "%02x".format(it) }}")
    // Format 1: 9+ bytes (old format, first 2 bytes are prefix)
    if (data.size >= 9) {
        val soc = data[2].toInt() and 0xFF
        val voltage = ((data[4].toInt() and 0xFF) shl 8) or (data[3].toInt() and 0xFF)
        val current = ((data[6].toInt() and 0xFF) shl 8) or (data[5].toInt() and 0xFF)
        val safety = ((data[8].toInt() and 0xFF) shl 8) or (data[7].toInt() and 0xFF)
        Log.d("BMS_BLE", "parseMfgData(fmt1 9B): soc=$soc V=$voltage I=$current safety=0x${safety.toString(16)}")
        return intArrayOf(soc, voltage, current, safety)
    }
    // Format 2: 7 bytes (new format, no prefix)
    if (data.size >= 7) {
        val soc = data[0].toInt() and 0xFF
        val voltage = ((data[2].toInt() and 0xFF) shl 8) or (data[1].toInt() and 0xFF)
        val current = ((data[4].toInt() and 0xFF) shl 8) or (data[3].toInt() and 0xFF)
        val safety = ((data[6].toInt() and 0xFF) shl 8) or (data[5].toInt() and 0xFF)
        Log.d("BMS_BLE", "parseMfgData(fmt2 7B): soc=$soc V=$voltage I=$current safety=0x${safety.toString(16)}")
        return intArrayOf(soc, voltage, current, safety)
    }
    Log.d("BMS_BLE", "parseMfgData: data too short (${data.size} bytes)")
    return null
}

fun parseAdData(bytes: ByteArray): IntArray? {
    var i = 0
    while (i < bytes.size - 3) {
        val len = bytes[i].toInt() and 0xFF
        if (len == 0 || i + len >= bytes.size) break
        val type = bytes[i + 1].toInt() and 0xFF
        if (type == 0xFF && len >= 12) {
            val mfgId = ((bytes[i + 3].toInt() and 0xFF) shl 8) or (bytes[i + 2].toInt() and 0xFF)
            if (mfgId == 0xFF0A) {
                val off = i + 4
                val soc = bytes[off + 2].toInt() and 0xFF
                val voltage = ((bytes[off + 4].toInt() and 0xFF) shl 8) or (bytes[off + 3].toInt() and 0xFF)
                val current = ((bytes[off + 6].toInt() and 0xFF) shl 8) or (bytes[off + 5].toInt() and 0xFF)
                val safety = ((bytes[off + 8].toInt() and 0xFF) shl 8) or (bytes[off + 7].toInt() and 0xFF)
                return intArrayOf(soc, voltage, current, safety)
            }
        }
        i += len + 1
    }
    return null
}

class BleManager {
    val devices = mutableStateListOf<BleDevice>()
    val scanning = mutableStateOf(false)
    val connected = mutableStateOf(false)
    val connectedDevice = mutableStateOf<BleDevice?>(null)
    val connectionError = mutableStateOf(false)
    val connectingDevice = mutableStateOf<BleDevice?>(null)
    val rememberedDevices = mutableStateListOf<BleDevice>()
    val scanStatus = mutableStateOf("")

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bleConnection: BleConnection? = null
    private var pendingDataCallback: ((ByteArray) -> Unit)? = null
    private val backgroundScanCache = mutableListOf<BleDevice>()
    private val missCount = mutableMapOf<String, Int>()
    private var prefs: SharedPreferences? = null

    companion object {
        const val SERVICE_UUID = "0000ff00-0000-1000-8000-00805f9b34fb"
        const val NOTIFY_UUID = "0000ff01-0000-1000-8000-00805f9b34fb"
        const val WRITE_UUID = "0000ff02-0000-1000-8000-00805f9b34fb"
        const val NAME_PREFIX = "DCSF"
        const val MAX_DEVICES = 30
        private const val PREFS_NAME = "bms_devices"
        private const val KEY_REMEMBERED = "remembered_devices"
    }

    fun initPrefs(context: Context) {
        if (prefs != null) return
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        loadRememberedDevices()
    }

    private fun loadRememberedDevices() {
        val json = prefs?.getString(KEY_REMEMBERED, "") ?: ""
        if (json.isBlank()) return
        try {
            val arr = org.json.JSONArray(json)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val device = BleDevice(
                    name = obj.getString("name"),
                    address = obj.getString("address"),
                    rssi = 0,
                    lastSeen = System.currentTimeMillis(),
                )
                if (rememberedDevices.none { it.address == device.address }) {
                    rememberedDevices.add(device)
                }
            }
            Log.d("BMS_BLE", "Loaded ${rememberedDevices.size} remembered devices from prefs")
        } catch (e: Exception) {
            Log.e("BMS_BLE", "Failed to load remembered devices", e)
        }
    }

    private fun saveRememberedDevices() {
        try {
            val arr = org.json.JSONArray()
            for (dev in rememberedDevices) {
                val obj = org.json.JSONObject()
                obj.put("name", dev.name)
                obj.put("address", dev.address)
                arr.put(obj)
            }
            prefs?.edit()?.putString(KEY_REMEMBERED, arr.toString())?.apply()
            Log.d("BMS_BLE", "Saved ${rememberedDevices.size} remembered devices to prefs")
        } catch (e: Exception) {
            Log.e("BMS_BLE", "Failed to save remembered devices", e)
        }
    }

    fun rememberDevice(device: BleDevice) {
        val idx = rememberedDevices.indexOfFirst { it.address == device.address }
        if (idx >= 0) {
            rememberedDevices[idx] = device
        } else {
            rememberedDevices.add(device)
        }
        saveRememberedDevices()
        Log.d("BMS_BLE", "rememberDevice: ${device.name} (${device.address}), total=${rememberedDevices.size}")
    }

    fun forgetDevice(address: String) {
        rememberedDevices.removeAll { it.address == address }
        // Do NOT remove from devices list - let processScanCycle handle it naturally.
        // If still being scanned, the device will appear in "new devices".
        // If not, it will be removed after scan miss threshold.
        saveRememberedDevices()
        Log.d("BMS_BLE", "forgetDevice: $address, removed from remembered only")
    }

    fun isRemembered(address: String): Boolean = rememberedDevices.any { it.address == address }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val name = result.device.name ?: return
            if (!name.startsWith(NAME_PREFIX)) return

            var soc = 0; var voltage = 0; var current = 0; var safety = 0
            val scanRecord = result.scanRecord
            if (scanRecord != null) {
                // Method 1: Use getManufacturerSpecificData API (API 21+, more reliable)
                val mfgDataMap = scanRecord.manufacturerSpecificData
                if (mfgDataMap != null && mfgDataMap.size() > 0) {
                    for (i in 0 until mfgDataMap.size()) {
                        val mfgId = mfgDataMap.keyAt(i)
                        val mfgData = mfgDataMap.valueAt(i)
                        val hexStr = mfgData.joinToString("") { "%02x".format(it) }
                        Log.d("BMS_BLE", "MfgData id=0x${mfgId.toString(16)} len=${mfgData.size} data=$hexStr")

                        val parsed = parseMfgData(mfgData)
                        if (parsed != null) {
                            soc = parsed[0]; voltage = parsed[1]; current = parsed[2]; safety = parsed[3]
                            Log.d("BMS_BLE", "Parsed mfg: soc=$soc V=$voltage I=$current safety=$safety")
                            break
                        }
                    }
                }

                // Method 2: If API method fails, try raw byte parsing
                if (soc == 0 && voltage == 0) {
                    val bytes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) scanRecord.bytes else getScanRecordBytes(scanRecord)
                    if (bytes != null) {
                        Log.d("BMS_BLE", "Raw bytes for $name: ${bytes.joinToString("") { "%02x".format(it) }}")
                        val parsed = parseAdData(bytes)
                        if (parsed != null) {
                            soc = parsed[0]; voltage = parsed[1]; current = parsed[2]; safety = parsed[3]
                            Log.d("BMS_BLE", "Parsed via raw: soc=$soc V=$voltage I=$current safety=$safety")
                        } else {
                            Log.d("BMS_BLE", "parseAdData returned null")
                        }
                    }
                }
            }

            val device = BleDevice(name, result.device.address, result.rssi, soc, voltage, current, safety, System.currentTimeMillis())

            // Update remembered device info if this device is remembered
            val remIdx = rememberedDevices.indexOfFirst { it.address == device.address }
            if (remIdx >= 0) {
                rememberedDevices[remIdx] = device
            }

            // Add to background cache (will be compared to display list in processScanCycle)
            val cacheIdx = backgroundScanCache.indexOfFirst { it.address == result.device.address }
            if (cacheIdx >= 0) {
                backgroundScanCache[cacheIdx] = device
            } else {
                backgroundScanCache.add(device)
            }
        }

        override fun onScanFailed(errorCode: Int) {
            scanning.value = false
            scanStatus.value = "Scan failed: $errorCode"

        }
    }

    fun startScan(context: Context) {
        if (scanning.value) return // Already scanning, prevent duplicate start
        val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bm?.adapter

        if (bluetoothAdapter == null) {
            scanStatus.value = "No Bluetooth adapter"
            scanning.value = false
            return
        }
        if (bluetoothAdapter?.isEnabled != true) {
            scanStatus.value = "Bluetooth is off"
            scanning.value = false
            return
        }

        val hasPerm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        }
        if (!hasPerm) {
            scanStatus.value = "No BLE permission"
            scanning.value = false
            return
        }

        val scanner = bluetoothAdapter?.bluetoothLeScanner
        if (scanner == null) {
            scanStatus.value = "No BLE scanner"
            scanning.value = false
            return
        }

        // Do NOT clear devices list - let processScanCycle handle removal
        // This preserves connected/remembered devices across scan restarts
        missCount.clear()
        backgroundScanCache.clear()
        scanning.value = true
        scanStatus.value = "Scanning..."
        // Don't use ScanFilter.setDeviceName - it does exact match, not prefix match.
        // We filter by name prefix in the scan callback instead.
        val settings = android.bluetooth.le.ScanSettings.Builder()
            .setScanMode(android.bluetooth.le.ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()
        try {
            scanner.startScan(emptyList(), settings, scanCallback)
        } catch (e: SecurityException) {
            scanStatus.value = "SecurityException: ${e.message}"
            scanning.value = false
        }
    }

    fun processScanCycle() {
        // Build a map of scanned addresses for quick lookup
        val cacheMap = backgroundScanCache.associateBy { it.address }
        val connAddr = connectedDevice.value?.address

        val toRemove = mutableListOf<BleDevice>()

        // Check existing display devices against cache
        for (dev in devices) {
            val isProtected = connAddr == dev.address || isRemembered(dev.address)
            val cached = cacheMap[dev.address]

            if (cached != null) {
                // Device found in cache - update it and reset miss count
                val idx = devices.indexOfFirst { it.address == dev.address }
                if (idx >= 0) {
                    devices[idx] = cached
                }
                missCount[dev.address] = 0
            } else {
                // Device not in cache - increment miss count
                val count = (missCount[dev.address] ?: 0) + 1
                missCount[dev.address] = count
                if (count > 5) {
                    if (!isProtected) {
                        toRemove.add(dev)
                        missCount.remove(dev.address)
                    } else {
                        // For protected devices, just clear RSSI but keep in list
                        val idx = devices.indexOfFirst { it.address == dev.address }
                        if (idx >= 0) {
                            devices[idx] = dev.copy(rssi = 0)
                        }
                        missCount[dev.address] = 0
                    }
                }
            }
        }

        // Add new devices from cache that aren't in display list yet
        for (cached in backgroundScanCache) {
            if (devices.none { it.address == cached.address } && devices.size < MAX_DEVICES) {
                devices.add(cached)
                missCount[cached.address] = 0
            }
        }

        if (toRemove.isNotEmpty()) {
            devices.removeAll(toRemove)
        }

        // Clear cache for next cycle
        backgroundScanCache.clear()
    }

    fun stopScan() {
        scanning.value = false
        bluetoothAdapter?.bluetoothLeScanner?.stopScan(scanCallback)
    }

    fun connect(context: Context, device: BleDevice, onResult: (Boolean) -> Unit) {
        stopScan()
        connectingDevice.value = device

        // Always disconnect old connection first
        bleConnection?.onDisconnected = null
        bleConnection?.disconnect()
        bleConnection = null
        connected.value = false
        connectedDevice.value = null

        val adapter = bluetoothAdapter
        if (adapter == null) { connectingDevice.value = null; onResult(false); return }
        val btDevice = adapter.getRemoteDevice(device.address)
        if (btDevice == null) { connectingDevice.value = null; onResult(false); return }

        bleConnection = BleConnection(btDevice, SERVICE_UUID, NOTIFY_UUID, WRITE_UUID)
        pendingDataCallback?.let { bleConnection?.onDataReceived = it }
        bleConnection?.onDisconnected = {
            connected.value = false
            connectedDevice.value = null
        }
        bleConnection?.connect(context) { success ->
            connectingDevice.value = null
            if (success) {
                connectedDevice.value = device
                connectionError.value = false
                // Ensure connected device stays in the devices list so it doesn't disappear
                if (devices.none { it.address == device.address }) {
                    devices.add(0, device)
                }
                missCount[device.address] = 0
            }
            onResult(success)
        }
    }

    fun disconnect() {
        bleConnection?.disconnect()
        bleConnection = null
        connected.value = false
        connectedDevice.value = null
    }

    fun send(data: ByteArray): Boolean {
        if (!connected.value) return false
        return bleConnection?.write(data) ?: false
    }

    fun setOnDataReceived(callback: (ByteArray) -> Unit) {
        pendingDataCallback = callback
        bleConnection?.onDataReceived = callback
    }

    // Search for a device by name predicate and connect to the first match
    // Returns true if a matching device was found and connection attempt started
    val qrScanStatus = mutableStateOf("")
    val qrScanning = mutableStateOf(false)

    fun findAndConnectByName(
        context: Context,
        namePredicate: (String) -> Boolean,
        onResult: (Boolean) -> Unit
    ) {
        qrScanning.value = true
        qrScanStatus.value = "Searching..."

        // First check if any already-scanned device matches
        val match = devices.firstOrNull { namePredicate(it.name) }
            ?: rememberedDevices.firstOrNull { namePredicate(it.name) }
        if (match != null) {
            qrScanStatus.value = "Found: ${match.name}"
            qrScanning.value = false
            connect(context, match) { success -> onResult(success) }
            return
        }

        // Not found in current list - start scanning
        startScan(context)

        // Use a coroutine-like approach: check scan results periodically
        val handler = android.os.Handler(android.os.Looper.getMainLooper())
        var attempts = 0
        val maxAttempts = 15 // 15 seconds max

        val runnable = object : Runnable {
            override fun run() {
                attempts++
                val found = devices.firstOrNull { namePredicate(it.name) }
                    ?: rememberedDevices.firstOrNull { namePredicate(it.name) }
                if (found != null) {
                    stopScan()
                    qrScanStatus.value = "Found: ${found.name}"
                    qrScanning.value = false
                    connect(context, found) { success -> onResult(success) }
                } else if (attempts >= maxAttempts) {
                    stopScan()
                    qrScanStatus.value = "Device not found"
                    qrScanning.value = false
                    onResult(false)
                } else {
                    handler.postDelayed(this, 1000L)
                }
            }
        }
        handler.postDelayed(runnable, 1000L)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BmsApp(
    bleManager: BleManager,
    colors: AppColors,
    darkTheme: Boolean,
    onRequestPermissions: () -> Unit,
    onConnectDevice: (BleDevice) -> Unit,
    onDisconnect: () -> Unit,
    onWebViewCreated: (WebView) -> Unit = {},
) {
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    var sidebarVisible by rememberSaveable { mutableStateOf(true) }
    val webView = remember { mutableStateOf<WebView?>(null) }
    val uiReady = remember { mutableStateOf(false) }
    val configuration = LocalConfiguration.current
    val isWideScreen = configuration.screenWidthDp >= 600
    val themeStr = if (darkTheme) "dark" else "light"

    // File chooser state for import functionality
    val fileChooserCallback = remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // File save dialog state for export functionality
    val pendingFileContent = remember { mutableStateOf<Pair<String, String>?>(null) } // (filename, content)
    val saveFileLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/csv")
    ) { uri ->
        val pending = pendingFileContent.value
        if (uri != null && pending != null) {
            val (filename, content) = pending
            try {
                context.contentResolver.openOutputStream(uri)?.use { os ->
                    os.write(content.toByteArray(Charsets.UTF_8))
                }
                pushToUi(webView, "bms:file-saved", """{"path":"${uri.toString()}","filename":"$filename"}""")
            } catch (e: Exception) {
                pushToUi(webView, "bms:file-save-error", """{"error":"${e.message?.replace("\"", "\\\"")}"""")
            }
        }
        pendingFileContent.value = null
    }
    val fileChooserLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = fileChooserCallback.value
        if (callback != null) {
            if (result.resultCode == android.app.Activity.RESULT_OK && result.data != null) {
                val uri = result.data!!.data
                if (uri != null) {
                    // Grant read permission for the URI
                    try {
                        context.contentResolver.takePersistableUriPermission(uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    } catch (_e: SecurityException) { /* ignore */ }
                    callback.onReceiveValue(arrayOf(uri))

                } else {
                    callback.onReceiveValue(null)
                }
            } else {
                callback.onReceiveValue(null)
            }
            fileChooserCallback.value = null
        }
    }

    // QR scan result dialog state
    var qrScanResult by remember { mutableStateOf<String?>(null) }
    var qrSearchStatus by remember { mutableStateOf("") }
    var qrSearching by remember { mutableStateOf(false) }
    var showConsole by rememberSaveable { mutableStateOf(false) }
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var showScanner by remember { mutableStateOf(false) }

    // Handle QR scan result - called from embedded scanner dialog
    val handleQrResult: (String) -> Unit = { scanned ->
        qrScanResult = scanned
        showScanner = false

        // Extract search term from scanned result
        val searchTerm = when {
            scanned.contains("SN=", ignoreCase = true) -> {
                scanned.substringAfter("SN=", "").substringBefore("&").substringBefore("#").trim()
            }
            scanned.startsWith("DC", ignoreCase = true) -> scanned.trim()
            else -> ""
        }

        if (searchTerm.isNotBlank()) {
            // Put extracted info into search box and switch to device tab
            searchQuery = searchTerm
            selectedTab = 0
            showConsole = false

            // Determine match predicate: DC = exact match, SN = fuzzy (contains) match
            val predicate: (String) -> Boolean = if (scanned.startsWith("DC", ignoreCase = true)) {
                { name -> name.equals(searchTerm, ignoreCase = true) }
            } else {
                { name -> name.contains(searchTerm, ignoreCase = true) }
            }

            qrSearching = true
            qrSearchStatus = "Searching: $searchTerm"

            bleManager.findAndConnectByName(context, predicate) { success ->
                qrSearching = false
                if (success) {
                    showConsole = true
                    // Floating toast that disappears after 2s
                    qrSearchStatus = "Connected: $searchTerm"
                } else {
                    qrSearchStatus = "Not found: $searchTerm"
                }
                // Clear the floating status after 2 seconds
                scope.launch {
                    delay(2000L)
                    qrSearchStatus = ""
                }
            }
        }
    }

    LaunchedEffect(bleManager.connected.value) {
        val status = if (bleManager.connected.value) "connected" else "disconnected"
        pushToUi(webView, "bms:connection-status", """{"status":"$status"}""")

        if (bleManager.connected.value) {
            showConsole = true
        } else {
            showConsole = false
        }
    }

    // Re-push connection status when console becomes visible to ensure WebView page is in sync
    LaunchedEffect(showConsole) {
        if (showConsole && bleManager.connected.value) {
            pushToUi(webView, "bms:connection-status", """{"status":"connected"}""")
        }
    }

    LaunchedEffect(darkTheme) {
        pushToUi(webView, "bms:theme-change", """{"theme":"$themeStr"}""")

    }

    LaunchedEffect(Unit) {
        bleManager.setOnDataReceived { data ->
            if (!uiReady.value) return@setOnDataReceived
            val hexStr = data.joinToString("") { "%02x".format(it) }
            pushToUi(webView, "bms:raw-data", """{"data":"$hexStr"}""")
        }
    }

    // Scan cycle - runs at BmsApp level so it continues even when BluetoothPage is not visible
    LaunchedEffect(bleManager.scanning.value) {
        while (bleManager.scanning.value) {
            kotlinx.coroutines.delay(1000L)
            bleManager.processScanCycle()
        }
    }

    val createWebView: (Context) -> WebView = { ctx ->
        WebView(ctx).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.databaseEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            // Set background color to match UI theme, preventing white flash
            val bgHex = if (darkTheme) "#060709" else "#F3F5F9"
            setBackgroundColor(android.graphics.Color.parseColor(bgHex))
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    Log.d("BMS_UI", "Page finished: $url")

                    super.onPageFinished(view, url)
                    uiReady.value = true
                    view?.evaluateJavascript("localStorage.setItem('bms-theme','$themeStr')", null)

                    val shim = """
                        window.__APP_BRIDGE__ = {
                            _handler: null,
                            onMessage: function(cb) { window.__APP_BRIDGE__._handler = cb; },
                            postMessage: function(msg) {
                                if(window.__NativeBridge__ && window.__NativeBridge__.postMessage) {
                                    window.__NativeBridge__.postMessage(JSON.stringify(msg));
                                }
                            },
                            sendFrame: function(json) {
                                if(window.__NativeBridge__ && window.__NativeBridge__.sendFrame) {
                                    window.__NativeBridge__.sendFrame(json);
                                }
                            },
                            getPlatform: function() {
                                if(window.__NativeBridge__ && window.__NativeBridge__.getPlatform) {
                                    return window.__NativeBridge__.getPlatform();
                                }
                            }
                        };
                    """
                    view?.evaluateJavascript(shim, null)
                }
                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    // Set background immediately to prevent white flash
                    val bg = if (darkTheme) "#060709" else "#F3F5F9"
                    view?.setBackgroundColor(android.graphics.Color.parseColor(bg))
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage): Boolean {
                    Log.d("BMS_JS", "${consoleMessage.message()} -- ${consoleMessage.sourceId()}:${consoleMessage.lineNumber()}")
                    return true
                }
                override fun onShowFileChooser(webView: WebView?, filePathCallback: ValueCallback<Array<Uri>>?, fileChooserParams: FileChooserParams?): Boolean {
                    fileChooserCallback.value?.onReceiveValue(null)
                    fileChooserCallback.value = filePathCallback
                    val intent = android.content.Intent(android.content.Intent.ACTION_GET_CONTENT)
                    intent.addCategory(android.content.Intent.CATEGORY_OPENABLE)
                    intent.type = "*/*"
                    intent.putExtra(android.content.Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/csv", "*/*"))
                    try {
                        fileChooserLauncher.launch(intent)
                    } catch (e: Exception) {

                        filePathCallback?.onReceiveValue(null)
                    }
                    return true
                }
            }
            addJavascriptInterface(object {
                @android.webkit.JavascriptInterface
                fun postMessage(json: String) {
                    try {
                        val msg = org.json.JSONObject(json)
                        val type = msg.optString("type", "")
                        val payload = msg.optJSONObject("payload")

                        when (type) {
                            "bms:frame-send" -> {
                                if (!bleManager.connected.value) {
                                    pushToUi(webView, "bms:connection-status", """{"status":"disconnected"}""")
                                    return@postMessage
                                }
                                val frameVal = payload?.opt("frame")
                                Log.d("BMS_BLE", "TX frame: ${frameVal.toString().take(40)}")
                                val frame: ByteArray? = when (frameVal) {
                                    is org.json.JSONArray -> {
                                        ByteArray(frameVal.length()) { frameVal.getInt(it).toByte() }
                                    }
                                    is String -> {
                                        if (frameVal.length % 2 != 0) null
                                        else ByteArray(frameVal.length / 2) { frameVal.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
                                    }
                                    else -> null
                                }
                                if (frame != null) {
                                    bleManager.send(frame)
                                    Log.d("BMS_BLE", "TX: ${frame.joinToString("") { "%02x".format(it) }}")
                                } else {

                                }
                            }
                            "bms:request-status" -> {
                                val status = if (bleManager.connected.value) "connected" else "disconnected"
                                pushToUi(webView, "bms:connection-status", """{"status":"$status"}""")
                                pushToUi(webView, "bms:theme-change", """{"theme":"$themeStr"}""")

                            }
                            "bms:ui-ready" -> {
                                val status = if (bleManager.connected.value) "connected" else "disconnected"
                                pushToUi(webView, "bms:connection-status", """{"status":"$status"}""")
                                pushToUi(webView, "bms:theme-change", """{"theme":"$themeStr"}""")

                            }
                            "bms:download-file" -> {
                                val filename = payload?.optString("filename", "download.bin") ?: "download.bin"
                                val content = payload?.optString("content", "") ?: ""
                                pendingFileContent.value = Pair(filename, content)
                                try {
                                    saveFileLauncher.launch(filename)
                                } catch (e: Exception) {
                                    pendingFileContent.value = null
                                    pushToUi(webView, "bms:file-save-error", """{"error":"${e.message?.replace("\"", "\\\"")}"}""")
                                }
                            }
                        }
                    } catch (_e: Exception) {

                    }
                }

                @android.webkit.JavascriptInterface
                fun sendFrame(json: String) {
                    if (!bleManager.connected.value) return
                    val nums = json.trim('[', ']').split(',').mapNotNull { it.trim().toIntOrNull() }
                    val frame = ByteArray(nums.size) { nums[it].toByte() }
                    bleManager.send(frame)
                }

                @android.webkit.JavascriptInterface
                fun getPlatform(): String {
                    return """{"platform":"app","version":"1.0.0","bluetoothSupported":true,"serialSupported":false}"""
                }

                @android.webkit.JavascriptInterface
                fun saveFile(filename: String, content: String): String {
                    try {
                        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                        val file = File(downloadsDir, filename)
                        FileOutputStream(file).use { it.write(content.toByteArray(Charsets.UTF_8)) }

                        return file.absolutePath
                    } catch (e: Exception) {

                        return ""
                    }
                }
            }, "__NativeBridge__")
            loadUrl("https://ui.bms.pub")
            webView.value = this
            onWebViewCreated(this)
        }
    }



    // Bottom bar: narrow screen shows it when not in console; wide screen shows it only when sidebar is visible
    val navBarInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val showBottomBar = if (isWideScreen) sidebarVisible else (!showConsole || !bleManager.connected.value)
    // Wide screen: sidebar width is adaptive - 38% of screen but capped at 340dp
    val sidebarWidthDp = (configuration.screenWidthDp * 0.38f).toInt().coerceAtMost(340).coerceAtLeast(280)

    Box(modifier = Modifier
        .fillMaxSize()
        .windowInsetsPadding(WindowInsets.statusBars)
    ) {
        // ===== Sidebar (wide screen only) =====
        if (isWideScreen && sidebarVisible) {
            Row(
                modifier = Modifier
                    .fillMaxHeight()
                    .align(Alignment.CenterStart)
            ) {
                Box(
                    modifier = Modifier
                        .width(sidebarWidthDp.dp)
                        .fillMaxHeight()
                ) {
                    BluetoothPage(
                        bleManager = bleManager,
                        colors = colors,
                        onRequestPermissions = onRequestPermissions,
                        onConnectDevice = onConnectDevice,
                        onDisconnect = onDisconnect,
                        onConnectedClick = { showConsole = true },
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(bottom = 48.dp + navBarInset),
                        searchQuery = searchQuery,
                        onSearchQueryChange = { searchQuery = it },
                        qrSearching = qrSearching,
                        qrSearchStatus = qrSearchStatus,
                    )
                }
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .fillMaxHeight()
                        .background(colors.border)
                )
            }
        }

        // ===== Main content area =====
        // In wide screen, the nav bar sits under the sidebar (not under content),
        // so the content area only needs navBarInset at the bottom.
        // In narrow screen, the nav bar spans full width under the content.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = if (isWideScreen && sidebarVisible) (sidebarWidthDp + 1).dp else 0.dp)
                .padding(bottom = if (!isWideScreen && showBottomBar) 48.dp + navBarInset else navBarInset)
        ) {
            // Always keep WebView in composition to prevent state loss on tab switch / rotation.
            // Overlay pages with opaque backgrounds cover it when it should be hidden.
            Box(modifier = Modifier.fillMaxSize()) {
                AndroidView(
                    factory = createWebView,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(top = if (!isWideScreen && showConsole && bleManager.connected.value) 40.dp else 0.dp),
                )
                // Narrow screen: header bar for console view
                if (!isWideScreen && showConsole && bleManager.connected.value) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(40.dp)
                            .background(colors.bg)
                            .clickable { showConsole = false }
                            .padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Default.ArrowBack,
                            contentDescription = null,
                            tint = colors.fg2,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                        Icon(
                            Icons.Default.BluetoothConnected,
                            contentDescription = null,
                            tint = colors.primary,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            bleManager.connectedDevice.value?.name ?: "BMS",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = colors.fg,
                        )
                    }
                }
                // Disconnected overlay (wide screen only)
                if (isWideScreen && !bleManager.connected.value) {
                    Box(
                        modifier = Modifier.fillMaxSize().background(colors.bg),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.BluetoothDisabled, contentDescription = null, modifier = Modifier.size(48.dp), tint = colors.fg3)
                            Spacer(Modifier.height(8.dp))
                            Text(stringResource(R.string.please_connect_ble), color = colors.fg3, fontSize = 14.sp)
                        }
                    }
                }
            }

            // Overlay pages on top of WebView (narrow screen)
            if (!isWideScreen) {
                when {
                    !showConsole || !bleManager.connected.value -> {
                        Box(modifier = Modifier.fillMaxSize().background(colors.bg)) {
                            when {
                                selectedTab == 0 -> {
                                    BluetoothPage(
                                        bleManager = bleManager,
                                        colors = colors,
                                        onRequestPermissions = onRequestPermissions,
                                        onConnectDevice = onConnectDevice,
                                        onDisconnect = onDisconnect,
                                        onConnectedClick = { showConsole = true },
                                        modifier = Modifier.fillMaxSize(),
                                        searchQuery = searchQuery,
                                        onSearchQueryChange = { searchQuery = it },
                                        qrSearching = qrSearching,
                                        qrSearchStatus = qrSearchStatus,
                                    )
                                }
                                selectedTab == 1 -> {
                                    ScanPage(
                                        colors = colors,
                                        bleManager = bleManager,
                                        onScanClick = { showScanner = true },
                                        qrScanResult = qrScanResult,
                                        qrSearchStatus = qrSearchStatus,
                                        qrSearching = qrSearching,
                                    )
                                }
                                selectedTab == 2 -> {
                                    MinePage(
                                        colors = colors,
                                        bleManager = bleManager,
                                        onDisconnect = onDisconnect,
                                    )
                                }
                            }
                        }
                    }
                }
            } else {
                // Wide screen: show MinePage when sidebar is hidden and tab is 2
                if (!sidebarVisible && selectedTab == 2) {
                    MinePage(
                        colors = colors,
                        bleManager = bleManager,
                        onDisconnect = onDisconnect,
                    )
                }
            }
        }

        // ===== Sidebar toggle button (wide screen only) =====
        if (isWideScreen) {
            Card(
                shape = RoundedCornerShape(4.dp),
                colors = CardDefaults.cardColors(containerColor = colors.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .offset(x = if (sidebarVisible) (sidebarWidthDp - 11).dp else 0.dp)
                    .size(width = 24.dp, height = 48.dp)
                    .clickable { sidebarVisible = !sidebarVisible },
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                    Icon(
                        if (sidebarVisible) Icons.Default.ChevronLeft else Icons.Default.ChevronRight,
                        contentDescription = if (sidebarVisible) stringResource(R.string.hide_sidebar) else stringResource(R.string.show_sidebar),
                        tint = colors.fg2,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }

        // ===== Bottom navigation bar (compact, matching UI height) =====
        if (showBottomBar) {
            // Nav bar width follows sidebar width on wide screen; full width on narrow screen
            val navBarFraction = if (isWideScreen) {
                (sidebarWidthDp / configuration.screenWidthDp.toFloat()).coerceIn(0.3f, 0.45f)
            } else {
                1f
            }
            val deviceTabSelected = if (isWideScreen) sidebarVisible else (selectedTab == 0 && !showConsole)
            val mineTabSelected = if (isWideScreen) (!sidebarVisible && selectedTab == 2) else (selectedTab == 2)

            Row(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth(navBarFraction)
                    .height(48.dp + navBarInset)
                    .padding(bottom = navBarInset)
                    .background(colors.navBg),
                horizontalArrangement = Arrangement.SpaceAround,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Device tab
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clickable {
                            showConsole = false
                            selectedTab = 0
                            if (isWideScreen) sidebarVisible = true
                        },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Icon(
                        if (bleManager.connected.value) Icons.Default.BluetoothConnected
                        else Icons.Default.Bluetooth,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = if (deviceTabSelected) colors.primary else colors.fg2,
                    )
                    Text(
                        stringResource(R.string.device_tab),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (deviceTabSelected) colors.primary else colors.fg2,
                    )
                }
                // Scan tab
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clickable {
                            showConsole = false
                            selectedTab = 1
                            showScanner = true
                        },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .background(colors.primary, RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Default.QrCodeScanner,
                            contentDescription = stringResource(R.string.scan),
                            tint = colors.primaryFg,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    Text(
                        stringResource(R.string.scan),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                        color = colors.fg2,
                    )
                }
                // Mine tab
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clickable {
                            showConsole = false
                            selectedTab = 2
                            if (isWideScreen) sidebarVisible = false
                        },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = if (mineTabSelected) colors.primary else colors.fg2,
                    )
                    Text(
                        stringResource(R.string.mine_tab),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (mineTabSelected) colors.primary else colors.fg2,
                    )
                }
            }
        }

        // ===== Embedded QR Scanner Dialog =====
        if (showScanner) {
            QrScannerDialog(
                onScanned = { handleQrResult(it) },
                onDismiss = { showScanner = false },
            )
        }

    }
}

/** Isolated header for BluetoothPage. Extracted as a separate composable so that
 * device-list updates (which cause BluetoothPage to recompose) do NOT force the
 * BasicTextField to recompose, preventing visual jitter/shaking. */
@Composable
fun BluetoothPageHeader(
    isScanning: Boolean,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    colors: AppColors,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            stringResource(R.string.nearby_devices),
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = colors.fg,
        )
        // Fixed-size Box prevents layout shift when indicator appears/disappears
        Box(modifier = Modifier.size(16.dp)) {
            if (isScanning) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = colors.primary,
                )
            }
        }
        // Search box
        Row(
            modifier = Modifier
                .weight(1f)
                .height(36.dp)
                .background(colors.surface, RoundedCornerShape(18.dp))
                .border(1.dp, colors.border, RoundedCornerShape(18.dp))
                .padding(horizontal = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(16.dp), tint = colors.fg3)
            Spacer(Modifier.width(6.dp))
            BasicTextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                modifier = Modifier.weight(1f),
                singleLine = true,
                textStyle = TextStyle(fontSize = 13.sp, color = colors.fg),
                cursorBrush = androidx.compose.ui.graphics.SolidColor(colors.primary),
                decorationBox = { innerTextField ->
                    if (searchQuery.isEmpty()) {
                        Text(stringResource(R.string.search_devices), fontSize = 13.sp, color = colors.fg3)
                    }
                    innerTextField()
                },
            )
            if (searchQuery.isNotEmpty()) {
                Spacer(Modifier.width(6.dp))
                Icon(
                    Icons.Default.Close,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp).clickable { onSearchQueryChange("") },
                    tint = colors.fg3,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BluetoothPage(
    bleManager: BleManager,
    colors: AppColors,
    onRequestPermissions: () -> Unit,
    onConnectDevice: (BleDevice) -> Unit,
    onDisconnect: () -> Unit,
    onConnectedClick: () -> Unit = {},
    modifier: Modifier = Modifier,
    searchQuery: String = "",
    onSearchQueryChange: (String) -> Unit = {},
    qrSearching: Boolean = false,
    qrSearchStatus: String = "",
) {
    val context = LocalContext.current
    val listState = rememberLazyListState()

    // Auto-scan whenever BluetoothPage becomes visible (re-triggers on recomposition from tab switch)
    val isConnected = bleManager.connected.value
    val isScanning = bleManager.scanning.value
    LaunchedEffect(isConnected, isScanning) {
        if (!isScanning && !isConnected) {
            if (hasBlePermissions(context)) {
                bleManager.startScan(context)
            } else {
                onRequestPermissions()
            }
        }
    }

    // Scan cycle is handled at BmsApp level for reliability

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.bg)
            .padding(16.dp)
    ) {
        BluetoothPageHeader(
            isScanning = bleManager.scanning.value,
            searchQuery = searchQuery,
            onSearchQueryChange = onSearchQueryChange,
            colors = colors,
        )

        // Floating QR search status toast (disappears after 2s via parent clearing qrSearchStatus)
        if (qrSearching || qrSearchStatus.isNotBlank()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                contentAlignment = Alignment.Center,
            ) {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = when {
                        qrSearchStatus.startsWith("Connected") -> Color(0xFF22C55E)
                        qrSearchStatus.startsWith("Not found") || qrSearchStatus.startsWith("Invalid") -> colors.danger
                        else -> colors.surface
                    },
                    shadowElevation = 4.dp,
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (qrSearching) {
                            CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp, color = colors.primary)
                        }
                        Text(
                            qrSearchStatus.ifBlank { stringResource(R.string.searching_device) },
                            fontSize = 12.sp,
                            color = if (qrSearchStatus.startsWith("Connected") || qrSearchStatus.startsWith("Not found")) Color.White else colors.fg,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }
        }

        if (bleManager.devices.isEmpty() && !bleManager.scanning.value) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.BluetoothDisabled,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = colors.fg3,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(stringResource(R.string.no_device_found), color = colors.fg3, fontSize = 14.sp)
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = {
                            if (hasBlePermissions(context)) bleManager.startScan(context) else onRequestPermissions()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = colors.primary),
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(stringResource(R.string.start_scan))
                    }
                }
            }
        } else {
            val connAddr = bleManager.connectedDevice.value?.address
            val connectingAddr = bleManager.connectingDevice.value?.address
            // Merge remembered devices with scan data: show remembered devices even if not currently scanned
            val remembered = bleManager.rememberedDevices.map { rd ->
                bleManager.devices.find { it.address == rd.address } ?: rd
            }.sortedByDescending { it.address == connAddr }
            val newDevs = bleManager.devices.filter { !bleManager.isRemembered(it.address) }
                .sortedByDescending { it.address == connAddr }
            // Apply search filter (fuzzy match on device name)
            val filteredRemembered = if (searchQuery.isBlank()) remembered else remembered.filter { it.name.contains(searchQuery, ignoreCase = true) }
            val filteredNewDevs = if (searchQuery.isBlank()) newDevs else newDevs.filter { it.name.contains(searchQuery, ignoreCase = true) }

            if (filteredRemembered.isEmpty() && filteredNewDevs.isEmpty() && searchQuery.isNotBlank()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        stringResource(R.string.no_matching_device),
                        color = colors.fg3,
                        fontSize = 14.sp,
                    )
                }
            } else {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (filteredRemembered.isNotEmpty()) {
                    item {
                        Text(
                            stringResource(R.string.saved_devices),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = colors.fg2,
                            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                        )
                    }
                    items(filteredRemembered, key = { it.address }) { device ->
                        val isConn = connAddr != null && device.address == connAddr
                        val isConnecting = connectingAddr != null && device.address == connectingAddr
                        SwipeDeviceCard(
                            device = device,
                            isConn = isConn,
                            isConnecting = isConnecting,
                            isRemembered = true,
                            colors = colors,
                            onClick = { onConnectDevice(device) },
                            onForget = { bleManager.forgetDevice(device.address) },
                            onSaveRemember = { bleManager.rememberDevice(device) },
                            onDisconnect = onDisconnect,
                            onConnectedClick = onConnectedClick,
                        )
                    }
                }
                if (filteredNewDevs.isNotEmpty()) {
                    item {
                        Text(
                            stringResource(R.string.new_devices),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = colors.fg2,
                            modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
                        )
                    }
                    items(filteredNewDevs, key = { it.address }) { device ->
                        val isConn = connAddr != null && device.address == connAddr
                        val isConnecting = connectingAddr != null && device.address == connectingAddr
                        SwipeDeviceCard(
                            device = device,
                            isConn = isConn,
                            isConnecting = isConnecting,
                            isRemembered = false,
                            colors = colors,
                            onClick = { onConnectDevice(device) },
                            onForget = { bleManager.forgetDevice(device.address) },
                            onSaveRemember = { bleManager.rememberDevice(device) },
                            onDisconnect = onDisconnect,
                            onConnectedClick = onConnectedClick,
                        )
                    }
                }
            }
            }
        }
    }
}


@Composable
fun SwipeDeviceCard(
    device: BleDevice,
    isConn: Boolean,
    isConnecting: Boolean = false,
    isRemembered: Boolean,
    colors: AppColors,
    onClick: () -> Unit,
    onForget: () -> Unit,
    onSaveRemember: () -> Unit,
    onDisconnect: () -> Unit,
    onConnectedClick: () -> Unit = {},
) {
    val onToggleRemember = if (isRemembered) onForget else onSaveRemember
    if (isConn) {
        ConnectedCard(
            device = device,
            colors = colors,
            onDisconnect = onDisconnect,
            onClick = onConnectedClick,
            isRemembered = isRemembered,
            onToggleRemember = onToggleRemember,
        )
    } else {
        DeviceCard(
            device = device,
            colors = colors,
            onClick = onClick,
            isConnecting = isConnecting,
            isRemembered = isRemembered,
            onToggleRemember = onToggleRemember,
        )
    }
}

@Composable
fun ConnectedCard(
    device: BleDevice,
    colors: AppColors,
    onDisconnect: () -> Unit,
    onClick: () -> Unit = {},
    isRemembered: Boolean = false,
    onToggleRemember: () -> Unit = {},
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = colors.surfaceConn, contentColor = colors.fg),
        border = CardDefaults.outlinedCardBorder(true),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Row(
            modifier = Modifier.padding(12.dp, 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SocCircle(
                soc = device.soc,
                isGlowing = true,
                trackColor = colors.track,
                modifier = Modifier.clickable(onClick = onDisconnect),
            )
            Spacer(Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(device.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = colors.fg)
                    Spacer(Modifier.weight(1f))
                    if (device.rssi != 0) {
                        RssiIndicator(device.rssi, showDbm = true, trackColor = colors.track, fg2Color = colors.fg2)
                    } else {
                        Text("--", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = colors.fg3)
                    }
                }
                Spacer(Modifier.height(3.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text("%.3fV".format(device.voltageV()), color = colors.fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Text("${if (device.currentA() > 0) "+" else ""}%.2fA".format(device.currentA()), color = colors.fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    val flags = SafetyBits.activeFlags(device.safety)
                    if (flags.isNotEmpty()) {
                        Box(
                            modifier = Modifier
                                .width(1.dp)
                                .height(12.dp)
                                .background(colors.border)
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                            modifier = Modifier.weight(1f).horizontalScroll(rememberScrollState()),
                        ) {
                            flags.forEach { f ->
                                val isAlarm = f in listOf("ALERT", "P_DSG", "COM_OUT")
                                val c = if (isAlarm) Color(0xFFEAB308) else Color(0xFFEF4444)
                                Surface(
                                    shape = RoundedCornerShape(3.dp),
                                    color = c.copy(alpha = 0.12f),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, c.copy(alpha = 0.25f)),
                                ) {
                                    Text(f, color = c, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp))
                                }
                            }
                        }
                    }
                }
            }
            // Star button for remember/forget
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clickable { onToggleRemember() },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (isRemembered) Icons.Default.Star else Icons.Default.StarBorder,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = if (isRemembered) Color(0xFFF59E0B) else colors.fg3,
                )
            }
        }
    }
}

@Composable
fun DeviceCard(
    device: BleDevice,
    colors: AppColors,
    onClick: () -> Unit,
    isConnecting: Boolean = false,
    isRemembered: Boolean = false,
    onToggleRemember: () -> Unit = {},
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = colors.surface),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Box {
            Row(
                modifier = Modifier.padding(12.dp, 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (isConnecting) {
                    Box(modifier = Modifier.size(46.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(32.dp),
                            strokeWidth = 3.dp,
                            color = colors.primary,
                        )
                    }
                } else {
                    SocCircle(soc = device.soc, isGlowing = false, trackColor = colors.track)
                }
                Spacer(Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(device.name, fontWeight = FontWeight.Medium, fontSize = 15.sp, color = colors.fg)
                        Spacer(Modifier.weight(1f))
                        if (device.rssi != 0) {
                            RssiIndicator(device.rssi, showDbm = true, trackColor = colors.track, fg2Color = colors.fg2)
                        } else {
                            Text("--", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = colors.fg3)
                        }
                    }
                    Spacer(Modifier.height(3.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text("%.3fV".format(device.voltageV()), color = colors.fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        Text("${if (device.currentA() > 0) "+" else ""}%.2fA".format(device.currentA()), color = colors.fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        val flags = SafetyBits.activeFlags(device.safety)
                        if (flags.isNotEmpty()) {
                            Box(
                                modifier = Modifier
                                    .width(1.dp)
                                    .height(12.dp)
                                    .background(colors.border)
                            )
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(3.dp),
                                modifier = Modifier.weight(1f).horizontalScroll(rememberScrollState()),
                            ) {
                                flags.forEach { f ->
                                    val isAlarm = f in listOf("ALERT", "P_DSG", "COM_OUT")
                                    val c = if (isAlarm) Color(0xFFEAB308) else Color(0xFFEF4444)
                                    Surface(
                                        shape = RoundedCornerShape(3.dp),
                                        color = c.copy(alpha = 0.12f),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, c.copy(alpha = 0.25f)),
                                    ) {
                                        Text(f, color = c, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp))
                                    }
                                }
                            }
                        }
                    }
                }
                // Star button for remember/forget
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clickable { onToggleRemember() },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        if (isRemembered) Icons.Default.Star else Icons.Default.StarBorder,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = if (isRemembered) Color(0xFFF59E0B) else colors.fg3,
                    )
                }
            }
            if (isConnecting) {
                // Semi-transparent overlay to show connecting state
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(colors.primary.copy(alpha = 0.06f), RoundedCornerShape(12.dp)),
                )
            }
        }
    }
}

@Composable
fun SocCircle(soc: Int, isGlowing: Boolean, trackColor: Color = Color(0xFFE5E7EB), modifier: Modifier = Modifier) {
    val color = when {
        soc > 50 -> Color(0xFF22C55E)
        soc > 20 -> Color(0xFFEAB308)
        else -> Color(0xFFEF4444)
    }
    val size = 46.dp
    val stroke = 5.dp
    Box(modifier = modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(size)) {
            val strokePx = stroke.toPx()
            val r = (size.toPx() - strokePx) / 2
            val center = Offset(size.toPx() / 2, size.toPx() / 2)
            drawCircle(color = trackColor, radius = r, center = center, style = Stroke(width = strokePx))
            val sweep = 360f * soc / 100f
            // Glow effect when connected
            if (isGlowing) {
                for (i in 1..3) {
                    drawArc(
                        color = color.copy(alpha = 0.08f * (4 - i)),
                        startAngle = 90f + (360f - sweep) / 2f,
                        sweepAngle = sweep,
                        useCenter = false,
                        topLeft = Offset(strokePx / 2 - i * 2, strokePx / 2 - i * 2),
                        size = Size(size.toPx() - strokePx + i * 4, size.toPx() - strokePx + i * 4),
                        style = Stroke(width = strokePx + i * 4, cap = StrokeCap.Round),
                    )
                }
            }
            drawArc(
                color = color,
                startAngle = 90f + (360f - sweep) / 2f,
                sweepAngle = sweep,
                useCenter = false,
                topLeft = Offset(strokePx / 2, strokePx / 2),
                size = Size(size.toPx() - strokePx, size.toPx() - strokePx),
                style = Stroke(width = strokePx, cap = StrokeCap.Round),
            )
        }
        Text("$soc", color = color, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun RssiIndicator(rssi: Int, showDbm: Boolean = false, trackColor: Color = Color(0xFFE5E7EB), fg2Color: Color = Color(0xFF6B7280)) {
    val color = when {
        rssi >= -75 -> Color(0xFF22C55E) // -45 to -75: green
        rssi >= -85 -> Color(0xFFF59E0B) // -76 to -85: orange
        else -> Color(0xFFEF4444)        // -86 and below: red
    }
    Text("${rssi}dBm", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = color)
}

@Composable
fun UiPage(
    bleManager: BleManager,
    colors: AppColors,
    webView: MutableState<WebView?>,
    darkTheme: Boolean = false,
    modifier: Modifier = Modifier,
    createWebView: (android.content.Context) -> WebView,
    pushToUi: (String, String) -> Unit,
) {
    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            factory = createWebView,
            modifier = Modifier.fillMaxSize(),
        )
        if (!bleManager.connected.value) {
            Box(
                modifier = Modifier.fillMaxSize().background(colors.bg),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.BluetoothDisabled, contentDescription = null, modifier = Modifier.size(48.dp), tint = colors.fg3)
                    Spacer(Modifier.height(8.dp))
                    Text(stringResource(R.string.please_connect_ble), color = colors.fg3, fontSize = 14.sp)
                }
            }
        }
    }
}

// ===== Embedded QR Scanner Overlay (full-screen, no Dialog to avoid SurfaceView window issues) =====
@Composable
fun QrScannerDialog(
    onScanned: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    var hasPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }
    var scannerView by remember { mutableStateOf<DecoratedBarcodeView?>(null) }
    var hasScanned by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted) onDismiss()
        else hasPermission = true
    }

    LaunchedEffect(Unit) {
        if (!hasPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    BackHandler { onDismiss() }

    // Resume scanner after view is attached and laid out
    LaunchedEffect(scannerView, hasPermission) {
        if (scannerView != null && hasPermission) {
            val sv = scannerView!!
            // Wait for the view to have non-zero dimensions, then resume on next frame
            sv.post {
                if (sv.width > 0 && sv.height > 0) {
                    sv.resume()
                } else {
                    sv.viewTreeObserver.addOnGlobalLayoutListener(object : ViewTreeObserver.OnGlobalLayoutListener {
                        override fun onGlobalLayout() {
                            if (sv.width > 0 && sv.height > 0) {
                                sv.viewTreeObserver.removeOnGlobalLayoutListener(this)
                                sv.post { sv.resume() }
                            }
                        }
                    })
                }
            }
        }
    }

    DisposableEffect(scannerView) {
        onDispose {
            scannerView?.pause()
            scannerView = null
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        if (hasPermission) {
            AndroidView(
                factory = { ctx ->
                    DecoratedBarcodeView(ctx).apply {
                        barcodeView.decoderFactory = DefaultDecoderFactory(listOf(BarcodeFormat.QR_CODE))
                        decodeContinuous { result ->
                            val text = result.text
                            if (text != null && text.isNotEmpty() && !hasScanned) {
                                hasScanned = true
                                pause()
                                onScanned(text)
                            }
                        }
                        scannerView = this
                    }
                },
                modifier = Modifier.fillMaxSize(),
            )
        }

        // Top bar with title and close button
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.Black.copy(alpha = 0.6f))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                stringResource(R.string.scan_qr_code),
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.weight(1f))
            Icon(
                Icons.Default.Close,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier
                    .size(28.dp)
                    .clickable { onDismiss() },
            )
        }

        // Hint text at bottom
        Text(
            "SN / DC",
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 13.sp,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp),
        )
    }
}

// ===== Scan Page =====
@Composable
fun ScanPage(
    colors: AppColors,
    bleManager: BleManager,
    onScanClick: () -> Unit,
    qrScanResult: String?,
    qrSearchStatus: String,
    qrSearching: Boolean,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(40.dp))

        Text(
            stringResource(R.string.scan_qr_code),
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = colors.fg,
        )

        Spacer(Modifier.height(8.dp))

        Text(
            "SN / DC",
            fontSize = 13.sp,
            color = colors.fg2,
        )

        Spacer(Modifier.height(40.dp))

        // Scan button
        Button(
            onClick = onScanClick,
            colors = ButtonDefaults.buttonColors(containerColor = colors.primary),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.size(width = 200.dp, height = 56.dp),
        ) {
            Icon(Icons.Default.QrCodeScanner, contentDescription = null, modifier = Modifier.size(28.dp), tint = colors.primaryFg)
            Spacer(Modifier.width(8.dp))
            Text(stringResource(R.string.scan), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = colors.primaryFg)
        }

        Spacer(Modifier.height(32.dp))

        // Show scan result
        if (qrScanResult != null) {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = colors.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        stringResource(R.string.scan_result),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = colors.fg2,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        qrScanResult,
                        fontSize = 13.sp,
                        color = colors.fg,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        }

        // Show search status
        if (qrSearching || qrSearchStatus.isNotBlank()) {
            Spacer(Modifier.height(16.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (qrSearching) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = colors.primary,
                    )
                    Spacer(Modifier.width(10.dp))
                }
                Text(
                    qrSearchStatus.ifBlank { stringResource(R.string.searching_device) },
                    fontSize = 14.sp,
                    color = if (qrSearchStatus.startsWith("Connected")) Color(0xFF22C55E)
                           else if (qrSearchStatus.startsWith("Device not found") || qrSearchStatus.startsWith("Invalid")) colors.danger
                           else colors.fg2,
                    fontWeight = FontWeight.Medium,
                )
            }
        }
    }
}

// ===== Mine Page =====
@Composable
fun MinePage(
    colors: AppColors,
    bleManager: BleManager,
    onDisconnect: () -> Unit,
) {
    val context = LocalContext.current
    val packageInfo = remember {
        try {
            context.packageManager.getPackageInfo(context.packageName, 0)
            "${context.packageManager.getPackageInfo(context.packageName, 0).versionName} (${context.packageManager.getPackageInfo(context.packageName, 0).versionCode})"
        } catch (e: Exception) {
            "1.0.0"
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg)
            .padding(24.dp),
    ) {
        Spacer(Modifier.height(20.dp))

        // App icon and name
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .background(colors.primary.copy(alpha = 0.1f), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.BatteryChargingFull,
                    contentDescription = null,
                    tint = colors.primary,
                    modifier = Modifier.size(32.dp),
                )
            }
            Spacer(Modifier.width(16.dp))
            Column {
                Text(
                    stringResource(R.string.app_name),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.fg,
                )
                Text(
                    "${stringResource(R.string.app_version)}: $packageInfo",
                    fontSize = 12.sp,
                    color = colors.fg2,
                )
            }
        }

        Spacer(Modifier.height(32.dp))

        // Connected device info
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = colors.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    stringResource(R.string.connected_device),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = colors.fg2,
                )
                Spacer(Modifier.height(8.dp))
                if (bleManager.connected.value && bleManager.connectedDevice.value != null) {
                    val dev = bleManager.connectedDevice.value!!
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        SocCircle(soc = dev.soc, isGlowing = true, trackColor = colors.track, modifier = Modifier.size(40.dp))
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(dev.name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = colors.fg)
                            Text(dev.address, fontSize = 11.sp, color = colors.fg2)
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = onDisconnect,
                        colors = ButtonDefaults.buttonColors(containerColor = colors.danger.copy(alpha = 0.1f)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(stringResource(R.string.disconnect), color = colors.danger, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                    }
                } else {
                    Text(
                        stringResource(R.string.not_connected),
                        fontSize = 14.sp,
                        color = colors.fg3,
                    )
                }
            }
        }

        Spacer(Modifier.height(24.dp))

        // Saved devices count
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = colors.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Default.Bluetooth, contentDescription = null, tint = colors.primary, modifier = Modifier.size(24.dp))
                Spacer(Modifier.width(12.dp))
                Text(stringResource(R.string.saved_devices), fontSize = 14.sp, color = colors.fg, modifier = Modifier.weight(1f))
                Text("${bleManager.rememberedDevices.size}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = colors.primary)
            }
        }
    }
}
