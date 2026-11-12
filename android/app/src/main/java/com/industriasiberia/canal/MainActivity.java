package com.industriasiberia.canal;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import androidx.appcompat.app.AppCompatDelegate;
import com.getcapacitor.BridgeActivity;

/**
 * La app de Iberia en Android: la WebView de Capacitor con el canal adentro.
 *
 * Dos ajustes, los dos para que las barras del sistema no tapen ni desentonen:
 *
 * - **Siempre en modo claro.** El canal no tiene tema oscuro. Con el teléfono en
 *   modo oscuro, el plugin SystemBars de Capacitor ponía los iconos de la barra de
 *   estado en blanco, sobre el fondo claro de la página: no se veían. Va antes de
 *   `super.onCreate`, que es cuando AppCompat lee el modo. No se fija con
 *   `SystemBars.style` en capacitor.config.ts porque ese valor también lo lee iOS.
 *
 * - **De borde a borde en todas las versiones**, no solo desde Android 15, que lo
 *   impone: barras transparentes con iconos oscuros, y la página se aparta de
 *   ellas con `env(safe-area-inset-*)` (las `--seguro-*` de globals.css), igual
 *   que en el iPhone.
 */
public class MainActivity extends BridgeActivity {

    private static final int VELO_NAVEGACION = Color.argb(0x80, 0x1b, 0x1b, 0x1b);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(
            this,
            SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            // Android 7 no pinta iconos oscuros en la barra de navegación: ahí va
            // un velo oscuro para que sus iconos blancos se vean.
            SystemBarStyle.light(Color.TRANSPARENT, VELO_NAVEGACION)
        );
    }
}
