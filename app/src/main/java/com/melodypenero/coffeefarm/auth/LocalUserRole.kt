package com.melodypenero.coffeefarm.auth

import androidx.compose.runtime.compositionLocalOf

val LocalUserRole = compositionLocalOf<UserRole> {
    error("LocalUserRole: not provided — use only under authenticated app shell")
}
