plugins {
    id("com.android.application")
}

android {
    namespace = "com.darestunts.tv"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.darestunts.tv"
        minSdk = 24            // androidx.webkit 1.17.0's floor
        targetSdk = 37
        versionCode = 17
        versionName = "3.13-tv"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // Serves the bundled game from https://appassets.androidplatform.net/, which
    // is a secure context -- what the ES modules the game is built from and the
    // Gamepad API both require, and what file:// is not.
    implementation("androidx.webkit:webkit:1.17.0")
}
