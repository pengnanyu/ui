package com.dcsf.bms

import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothGattDescriptor
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.UUID

@Suppress("DEPRECATION")
fun getCharValue(c: BluetoothGattCharacteristic): ByteArray? = c.value

class BleConnection(
    private val device: BluetoothDevice,
    private val serviceUuid: String,
    private val notifyUuid: String,
    private val writeUuid: String,
) {
    var onDataReceived: ((ByteArray) -> Unit)? = null
    var onDisconnected: (() -> Unit)? = null
    private var gatt: BluetoothGatt? = null
    private var notifyChar: BluetoothGattCharacteristic? = null
    private var writeChar: BluetoothGattCharacteristic? = null
    private val handler = Handler(Looper.getMainLooper())
    private var connectionEstablished = false

    private val idleBuffer = mutableListOf<Byte>()
    private var idleTimer: Runnable? = null
    private var idleMs = 30L
    private val MAX_BUFFER_BEFORE_FLUSH = 512

    fun connect(context: Context, onResult: (Boolean) -> Unit) {
        gatt = device.connectGatt(context, false, object : BluetoothGattCallback() {
            override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    LogCollector.log("BLE", "GATT connected, requesting MTU")
                    gatt.requestMtu(256)
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    LogCollector.log("BLE", "GATT disconnected status=$status")
                    handler.post {
                        if (connectionEstablished) {
                            connectionEstablished = false
                            onDisconnected?.invoke()
                        } else {
                            onResult(false)
                        }
                    }
                }
            }

            override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
                LogCollector.log("BLE", "MTU negotiated: $mtu status=$status")
                gatt.discoverServices()
            }

            override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                LogCollector.log("BLE", "Services discovered status=$status")
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    handler.post { onResult(false) }
                    return
                }

                val service = gatt.getService(UUID.fromString(serviceUuid))
                if (service == null) {
                    handler.post { onResult(false) }
                    return
                }

                notifyChar = service.getCharacteristic(UUID.fromString(notifyUuid))
                writeChar = service.getCharacteristic(UUID.fromString(writeUuid))

                if (notifyChar == null || writeChar == null) {
                    handler.post { onResult(false) }
                    return
                }

                if (notifyChar != null) {
                    gatt.setCharacteristicNotification(notifyChar, true)
                    LogCollector.log("BLE", "Notify char set, writing descriptor")
                    val desc = notifyChar!!.descriptors.firstOrNull()
                    if (desc != null) {
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                            gatt.writeDescriptor(desc, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
                        } else {
                            @Suppress("DEPRECATION")
                            desc.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                            @Suppress("DEPRECATION")
                            gatt.writeDescriptor(desc)
                        }
                    }
                }

                connectionEstablished = true
                handler.post { onResult(true) }
                LogCollector.log("BLE", "BLE ready, notifications enabled")
            }

            private var rxLogCounter = 0
            fun handleCharacteristicChange(value: ByteArray) {
                if (rxLogCounter++ % 10 == 0) {
                    LogCollector.log("BLE", "RX ${value.size}B: ${value.joinToString("") { "%02x".format(it) }.take(40)}")
                }
                synchronized(idleBuffer) {
                    for (b in value) idleBuffer.add(b)
                }
                scheduleIdleFlush()
            }

            override fun onCharacteristicChanged(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                value: ByteArray,
            ) {
                handleCharacteristicChange(value)
            }

            @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
            override fun onCharacteristicChanged(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
            ) {
                handleCharacteristicChange(if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) characteristic.value ?: return else getCharValue(characteristic) ?: return)
            }
        })
    }

    private fun scheduleIdleFlush() {
        synchronized(idleBuffer) {
            if (idleBuffer.size >= MAX_BUFFER_BEFORE_FLUSH) {
                val chunk = idleBuffer.toByteArray()
                idleBuffer.clear()
                handler.post { onDataReceived?.invoke(chunk) }
                idleTimer?.let { handler.removeCallbacks(it) }
                idleTimer = null
                return
            }
        }
        idleTimer?.let { handler.removeCallbacks(it) }
        val runnable = Runnable {
            val chunk: ByteArray
            synchronized(idleBuffer) {
                if (idleBuffer.isEmpty()) return@Runnable
                chunk = idleBuffer.toByteArray()
                idleBuffer.clear()
            }
            onDataReceived?.invoke(chunk)
        }
        idleTimer = runnable
        handler.postDelayed(runnable, idleMs)
    }

    private var txLogCounter = 0
    fun write(data: ByteArray): Boolean {
        val char = writeChar ?: return false
        val g = gatt ?: return false
        if (txLogCounter++ % 10 == 0) {
            LogCollector.log("BLE", "TX ${data.size}B: ${data.joinToString("") { "%02x".format(it) }.take(40)}")
        }
        // Flush any pending data before sending new frame
        // (idle timer mechanism handles normal delivery; this ensures no data is lost)
        idleTimer?.let { handler.removeCallbacks(it) }
        idleTimer = null
        synchronized(idleBuffer) {
            if (idleBuffer.isNotEmpty()) {
                val chunk = idleBuffer.toByteArray()
                idleBuffer.clear()
                handler.post { onDataReceived?.invoke(chunk) }
            }
        }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            val result = g.writeCharacteristic(char, data, BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE)
            return result == android.bluetooth.BluetoothGatt.GATT_SUCCESS
        } else {
            @Suppress("DEPRECATION")
            char.value = data
            @Suppress("DEPRECATION")
            char.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
            @Suppress("DEPRECATION")
            return g.writeCharacteristic(char)
        }
    }

    fun disconnect() {
        connectionEstablished = false
        idleTimer?.let { handler.removeCallbacks(it) }
        idleTimer = null
        synchronized(idleBuffer) { idleBuffer.clear() }
        gatt?.close()
        gatt = null
    }
}
