<#
    Genera los assets web de la marca Iberia a partir del máster.

        pwsh scripts/generar-marca.ps1
        pwsh scripts/generar-marca.ps1 -SoloIos       # solo la app de iOS
        pwsh scripts/generar-marca.ps1 -SoloAndroid   # solo la app de Android

    Requiere Windows (usa GDI+ vía System.Drawing). Los assets resultantes se
    commitean, así que este script solo hace falta si cambia el logo original.

    Entrada:  assets/marca/LOGO-IBERIA.jpg   (rojo sobre blanco, con sombra)
    Salida:   public/marca/*.png  y  app/icon.png
              ios/App/App/Assets.xcassets: el icono de la app y la pantalla de arranque
              android/app/src/main/res: los iconos (adaptativo y clásico) y el arranque

    El JPG viene con fondo blanco y una sombra gris suave. Aquí se recorta al
    contenido, se descarta la sombra (gris = saturación baja) y se reconstruye
    el alfa a partir de la "cantidad de tinta", recoloreando al rojo de marca
    exacto o a blanco para fondos oscuros.
#>

param(
    # Solo los assets de la app de iOS, sin volver a guardar los de la web:
    # `app/icon.png` no sale con los mismos bytes que el commiteado, y el diff
    # se llenaría de una imagen que no cambió.
    [switch] $SoloIos,
    # Solo los assets de la app de Android, por lo mismo.
    [switch] $SoloAndroid
)
if ($SoloIos -and $SoloAndroid) { throw 'Usa -SoloIos o -SoloAndroid, no los dos.' }

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$raiz = Split-Path -Parent $PSScriptRoot
$origen = Join-Path $raiz 'assets\marca\LOGO-IBERIA.jpg'
$destinoPublico = Join-Path $raiz 'public\marca'
$destinoApp = Join-Path $raiz 'app'
$destinoIos = Join-Path $raiz 'ios\App\App\Assets.xcassets'
$destinoAndroid = Join-Path $raiz 'android\app\src\main\res'

if (-not (Test-Path -LiteralPath $origen)) { throw "No se encontró el máster: $origen" }
New-Item -ItemType Directory -Force -Path $destinoPublico | Out-Null

# Rojo de marca, muestreado del máster (212, 51, 44).
$ROJO = [System.Drawing.Color]::FromArgb(212, 51, 44)

# Regiones del máster de 5906x4724, halladas por perfil de filas y columnas.
$LOGO_COMPLETO = [System.Drawing.Rectangle]::new(576, 1820, 4913, 1270)
$SOLO_ONDA = [System.Drawing.Rectangle]::new(576, 2610, 4913, 480)
# Las dos primeras letras. La onda sola es demasiado fina para un favicon: a
# 16 px se convierte en un borrón. "IB" con los trazos del logo sí se lee.
$LETRAS_IB = [System.Drawing.Rectangle]::new(573, 1826, 1249, 698)

# Saturación mínima para considerar que un píxel es tinta y no sombra gris.
$SAT_MINIMA = 28
# Mínimo canal del rojo puro: fija la escala del alfa para que el sólido quede opaco.
$MIN_CANAL_SOLIDO = 44.0

function Convertir {
    <#  Recorta, escala y reconstruye el alfa recoloreando a $color. #>
    param(
        [System.Drawing.Bitmap] $Fuente,
        [System.Drawing.Rectangle] $Region,
        [int] $AnchoDestino,
        [System.Drawing.Color] $Color
    )

    $escala = $AnchoDestino / $Region.Width
    $ancho = $AnchoDestino
    $alto = [int][math]::Round($Region.Height * $escala)

    $lienzo = [System.Drawing.Bitmap]::new($ancho, $alto, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($lienzo)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($Fuente, [System.Drawing.Rectangle]::new(0, 0, $ancho, $alto), $Region,
        [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()

    # LockBits en lugar de GetPixel: son millones de píxeles.
    $rect = [System.Drawing.Rectangle]::new(0, 0, $ancho, $alto)
    $datos = $lienzo.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $total = [math]::Abs($datos.Stride) * $alto
    $bytes = [byte[]]::new($total)
    [System.Runtime.InteropServices.Marshal]::Copy($datos.Scan0, $bytes, 0, $total)

    $cR = $Color.R; $cG = $Color.G; $cB = $Color.B
    $escalaAlfa = 255.0 / (255.0 - $MIN_CANAL_SOLIDO)

    for ($i = 0; $i -lt $total; $i += 4) {
        # En memoria el orden es B, G, R, A
        $b = $bytes[$i]; $v = $bytes[$i + 1]; $r = $bytes[$i + 2]

        $maxc = [math]::Max($r, [math]::Max($v, $b))
        $minc = [math]::Min($r, [math]::Min($v, $b))

        if (($maxc - $minc) -lt $SAT_MINIMA) {
            # Blanco del fondo o sombra gris: fuera.
            $bytes[$i + 3] = 0
            continue
        }

        $alfa = [int][math]::Round((255 - $minc) * $escalaAlfa)
        if ($alfa -gt 255) { $alfa = 255 } elseif ($alfa -lt 0) { $alfa = 0 }

        $bytes[$i] = $cB
        $bytes[$i + 1] = $cG
        $bytes[$i + 2] = $cR
        $bytes[$i + 3] = [byte]$alfa
    }

    [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $datos.Scan0, $total)
    $lienzo.UnlockBits($datos)
    return $lienzo
}

function Recortar {
    <#  Recorta el bitmap a sus píxeles con alfa, con un margen opcional. #>
    param([System.Drawing.Bitmap] $Bmp, [int] $Margen = 0)

    $rect = [System.Drawing.Rectangle]::new(0, 0, $Bmp.Width, $Bmp.Height)
    $datos = $Bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $total = [math]::Abs($datos.Stride) * $Bmp.Height
    $bytes = [byte[]]::new($total)
    [System.Runtime.InteropServices.Marshal]::Copy($datos.Scan0, $bytes, 0, $total)
    $stride = $datos.Stride
    $Bmp.UnlockBits($datos)

    $minX = $Bmp.Width; $minY = $Bmp.Height; $maxX = -1; $maxY = -1
    for ($y = 0; $y -lt $Bmp.Height; $y++) {
        $fila = $y * $stride
        for ($x = 0; $x -lt $Bmp.Width; $x++) {
            if ($bytes[$fila + $x * 4 + 3] -gt 8) {
                if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    if ($maxX -lt 0) { throw 'El bitmap quedó completamente transparente.' }

    $minX = [math]::Max(0, $minX - $Margen); $minY = [math]::Max(0, $minY - $Margen)
    $maxX = [math]::Min($Bmp.Width - 1, $maxX + $Margen)
    $maxY = [math]::Min($Bmp.Height - 1, $maxY + $Margen)

    $ancho = $maxX - $minX + 1; $alto = $maxY - $minY + 1
    $salida = [System.Drawing.Bitmap]::new($ancho, $alto, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($salida)
    $g.DrawImage($Bmp, [System.Drawing.Rectangle]::new(0, 0, $ancho, $alto),
        [System.Drawing.Rectangle]::new($minX, $minY, $ancho, $alto), [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    return $salida
}

function Guardar {
    param([System.Drawing.Bitmap] $Bmp, [string] $Ruta)
    $Bmp.Save($Ruta, [System.Drawing.Imaging.ImageFormat]::Png)
    $kb = [math]::Round((Get-Item -LiteralPath $Ruta).Length / 1KB, 1)
    Write-Host ("  {0,-34} {1,4}x{2,-4} {3,7} kB" -f (Split-Path -Leaf $Ruta), $Bmp.Width, $Bmp.Height, $kb)
}

$master = [System.Drawing.Bitmap]::new($origen)
Write-Host "`nGenerando assets de marca desde $([System.IO.Path]::GetFileName($origen)) ($($master.Width)x$($master.Height))`n"

# Ojo: los nombres de variable en PowerShell no distinguen mayúsculas, así que
# los bitmaps llevan prefijo `bmp` para no pisar $ROJO (el color de marca).
# El logo rojo y las letras se usan en la web y en iOS: se preparan una vez.
$bmpRojo = Recortar (Convertir $master $LOGO_COMPLETO 1400 $ROJO) 2
$bmpIB = Recortar (Convertir $master $LETRAS_IB 900 ([System.Drawing.Color]::White)) 1

# Proporción de "IB" sobre el lado de la baldosa, la misma en el favicon y en iOS.
$PROPORCION_IB = 0.72

if (-not $SoloIos -and -not $SoloAndroid) {
    # --- Logo completo, rojo y blanco ---------------------------------------
    Guardar $bmpRojo (Join-Path $destinoPublico 'iberia.png')

    $bmpBlanco = Recortar (Convertir $master $LOGO_COMPLETO 1400 ([System.Drawing.Color]::White)) 2
    Guardar $bmpBlanco (Join-Path $destinoPublico 'iberia-blanco.png')

    # --- Solo la onda, en blanco: es la forma que aguanta tamaños pequeños --
    $bmpOnda = Recortar (Convertir $master $SOLO_ONDA 900 ([System.Drawing.Color]::White)) 1
    Guardar $bmpOnda (Join-Path $destinoPublico 'iberia-onda-blanca.png')

    # --- Icono de la web: baldosa roja con "IB" en blanco ------------------
    $LADO = 512
    $icono = [System.Drawing.Bitmap]::new($LADO, $LADO, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($icono)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $radio = 96
    $ruta = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $ruta.AddArc(0, 0, $radio, $radio, 180, 90)
    $ruta.AddArc($LADO - $radio, 0, $radio, $radio, 270, 90)
    $ruta.AddArc($LADO - $radio, $LADO - $radio, $radio, $radio, 0, 90)
    $ruta.AddArc(0, $LADO - $radio, $radio, $radio, 90, 90)
    $ruta.CloseFigure()
    $g.FillPath([System.Drawing.SolidBrush]::new($ROJO), $ruta)
    $ruta.Dispose()

    $anchoIB = [int]($LADO * $PROPORCION_IB)
    $altoIB = [int][math]::Round($bmpIB.Height * ($anchoIB / $bmpIB.Width))
    $g.DrawImage($bmpIB, [int](($LADO - $anchoIB) / 2), [int](($LADO - $altoIB) / 2), $anchoIB, $altoIB)
    $g.Dispose()
    Guardar $icono (Join-Path $destinoApp 'icon.png')

    foreach ($b in @($bmpBlanco, $bmpOnda, $icono)) { $b.Dispose() }
}

$FONDO_CANAL = [System.Drawing.Color]::FromArgb(246, 247, 249)

function DibujarIB {
    <#  Pone "IB" centrado, a $Proporcion del lado, sobre un lienzo cuadrado. #>
    param([System.Drawing.Graphics] $G, [int] $Lado, [double] $Proporcion)
    $anchoIB = [int]($Lado * $Proporcion)
    $altoIB = [int][math]::Round($bmpIB.Height * ($anchoIB / $bmpIB.Width))
    $G.DrawImage($bmpIB, [int](($Lado - $anchoIB) / 2), [int](($Lado - $altoIB) / 2), $anchoIB, $altoIB)
}

function NuevoLienzo {
    param([int] $Ancho, [int] $Alto, [System.Drawing.Imaging.PixelFormat] $Formato)
    $bmp = [System.Drawing.Bitmap]::new($Ancho, $Alto, $Formato)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    return @($bmp, $g)
}

if (-not $SoloAndroid) {
    # --- App de iOS: icono ----------------------------------------------------
    # La misma baldosa, pero a sangre y SIN canal alfa: las esquinas las pone iOS, y
    # App Store Connect rechaza un icono de 1024 con transparencia. Por eso el lienzo
    # es de 24 bits (RGB) y no de 32 (ARGB): el PNG sale sin alfa, no con alfa opaco.
    $LADO_IOS = 1024
    $formatoSinAlfa = [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    $iconoIos = [System.Drawing.Bitmap]::new($LADO_IOS, $LADO_IOS, $formatoSinAlfa)
    $g = [System.Drawing.Graphics]::FromImage($iconoIos)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear($ROJO)

    $anchoIB = [int]($LADO_IOS * $PROPORCION_IB)
    $altoIB = [int][math]::Round($bmpIB.Height * ($anchoIB / $bmpIB.Width))
    $g.DrawImage($bmpIB, [int](($LADO_IOS - $anchoIB) / 2), [int](($LADO_IOS - $altoIB) / 2), $anchoIB, $altoIB)
    $g.Dispose()
    # El nombre es el que trae la plantilla de Capacitor en Contents.json.
    Guardar $iconoIos (Join-Path $destinoIos 'AppIcon.appiconset\AppIcon-512@2x.png')

    # --- App de iOS: pantalla de arranque ------------------------------------
    # La plantilla trae el logo de Capacitor. Se cambia por el de Iberia sobre el
    # fondo del canal (#f6f7f9), que es lo que aparece después: así el paso de la
    # pantalla de arranque al canal no parpadea. La imagen se recorta a lo ancho
    # del teléfono (aspect fill), así que el logo va al centro y con aire: en un
    # iPhone se ven unos 1.260 px de los 2.732.
    $LADO_ARRANQUE = 2732
    $arranque = [System.Drawing.Bitmap]::new($LADO_ARRANQUE, $LADO_ARRANQUE, $formatoSinAlfa)
    $g = [System.Drawing.Graphics]::FromImage($arranque)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear($FONDO_CANAL)

    $anchoLogo = 800
    $altoLogo = [int][math]::Round($bmpRojo.Height * ($anchoLogo / $bmpRojo.Width))
    $g.DrawImage($bmpRojo, [int](($LADO_ARRANQUE - $anchoLogo) / 2), [int](($LADO_ARRANQUE - $altoLogo) / 2), $anchoLogo, $altoLogo)
    $g.Dispose()
    # Los tres nombres que lista Splash.imageset/Contents.json (1x, 2x y 3x).
    foreach ($nombre in @('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png')) {
        Guardar $arranque (Join-Path $destinoIos "Splash.imageset\$nombre")
    }

    foreach ($b in @($iconoIos, $arranque)) { $b.Dispose() }
}

if (-not $SoloIos) {
    # --- App de Android: iconos ----------------------------------------------
    # La misma baldosa roja con "IB". Android pide dos juegos por densidad:
    #
    # - El adaptativo (Android 8+, `mipmap-anydpi-v26/ic_launcher.xml`): el fondo
    #   es el color `ic_launcher_background` (el rojo, en values/) y el frente un
    #   PNG transparente de 108 dp con "IB" en blanco. El sistema recorta al
    #   centro unos 72 dp con la forma que quiera el teléfono, así que "IB" ocupa
    #   la misma proporción de lo visible que en iOS (0,72 de 72 dp). El mismo
    #   frente sirve de `monochrome`, para los iconos temáticos de Android 13.
    # - El clásico (Android 7): baldosa de esquinas redondeadas y su versión
    #   redonda, de 48 dp.
    $DENSIDADES = [ordered]@{ mdpi = 1.0; hdpi = 1.5; xhdpi = 2.0; xxhdpi = 3.0; xxxhdpi = 4.0 }
    $formatoConAlfa = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    $PROPORCION_IB_ADAPTATIVO = $PROPORCION_IB * 72 / 108

    foreach ($densidad in $DENSIDADES.Keys) {
        $factor = $DENSIDADES[$densidad]
        $carpeta = Join-Path $destinoAndroid "mipmap-$densidad"
        New-Item -ItemType Directory -Force -Path $carpeta | Out-Null

        # Frente del adaptativo: 108 dp, transparente.
        $lado = [int](108 * $factor)
        $bmp, $g = NuevoLienzo $lado $lado $formatoConAlfa
        $g.Clear([System.Drawing.Color]::Transparent)
        DibujarIB $g $lado $PROPORCION_IB_ADAPTATIVO
        $g.Dispose()
        Guardar $bmp (Join-Path $carpeta 'ic_launcher_foreground.png')
        $bmp.Dispose()

        # Clásico: 48 dp, la baldosa con el margen de 1 dp que piden las guías.
        $lado = [int](48 * $factor)
        $margen = [int][math]::Round(1 * $factor)
        $util = $lado - 2 * $margen
        $radio = [int][math]::Round($util * 96 / 512)

        $bmp, $g = NuevoLienzo $lado $lado $formatoConAlfa
        $g.Clear([System.Drawing.Color]::Transparent)
        $ruta = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $ruta.AddArc($margen, $margen, 2 * $radio, 2 * $radio, 180, 90)
        $ruta.AddArc($margen + $util - 2 * $radio, $margen, 2 * $radio, 2 * $radio, 270, 90)
        $ruta.AddArc($margen + $util - 2 * $radio, $margen + $util - 2 * $radio, 2 * $radio, 2 * $radio, 0, 90)
        $ruta.AddArc($margen, $margen + $util - 2 * $radio, 2 * $radio, 2 * $radio, 90, 90)
        $ruta.CloseFigure()
        $g.FillPath([System.Drawing.SolidBrush]::new($ROJO), $ruta)
        $ruta.Dispose()
        DibujarIB $g $lado ($PROPORCION_IB * $util / $lado)
        $g.Dispose()
        Guardar $bmp (Join-Path $carpeta 'ic_launcher.png')
        $bmp.Dispose()

        # Redondo: el círculo es más angosto que la baldosa; "IB" se achica para
        # no tocar el borde.
        $bmp, $g = NuevoLienzo $lado $lado $formatoConAlfa
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.FillEllipse([System.Drawing.SolidBrush]::new($ROJO), $margen, $margen, $util, $util)
        DibujarIB $g $lado (0.62 * $util / $lado)
        $g.Dispose()
        Guardar $bmp (Join-Path $carpeta 'ic_launcher_round.png')
        $bmp.Dispose()
    }

    # --- App de Android: pantalla de arranque --------------------------------
    # En Android 12+ el arranque lo dibuja el sistema: el fondo del canal y el
    # icono adaptativo al centro (styles.xml). `splash_logo` es para el arranque
    # de respaldo de Capacitor y las versiones viejas: `drawable/splash.xml` lo
    # pone centrado sobre el fondo del canal, sin estirarlo, a 200 dp de ancho.
    foreach ($densidad in $DENSIDADES.Keys) {
        $factor = $DENSIDADES[$densidad]
        $carpeta = Join-Path $destinoAndroid "drawable-$densidad"
        New-Item -ItemType Directory -Force -Path $carpeta | Out-Null

        $ancho = [int](200 * $factor)
        $alto = [int][math]::Round($bmpRojo.Height * ($ancho / $bmpRojo.Width))
        $bmp, $g = NuevoLienzo $ancho $alto $formatoConAlfa
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.DrawImage($bmpRojo, 0, 0, $ancho, $alto)
        $g.Dispose()
        Guardar $bmp (Join-Path $carpeta 'splash_logo.png')
        $bmp.Dispose()
    }
}

foreach ($b in @($bmpRojo, $bmpIB, $master)) { $b.Dispose() }
Write-Host "`nListo.`n"
