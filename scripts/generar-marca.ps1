<#
    Genera los assets web de la marca Iberia a partir del máster.

        pwsh scripts/generar-marca.ps1

    Requiere Windows (usa GDI+ vía System.Drawing). Los assets resultantes se
    commitean, así que este script solo hace falta si cambia el logo original.

    Entrada:  assets/marca/LOGO-IBERIA.jpg   (rojo sobre blanco, con sombra)
    Salida:   public/marca/*.png  y  app/icon.png

    El JPG viene con fondo blanco y una sombra gris suave. Aquí se recorta al
    contenido, se descarta la sombra (gris = saturación baja) y se reconstruye
    el alfa a partir de la "cantidad de tinta", recoloreando al rojo de marca
    exacto o a blanco para fondos oscuros.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$raiz = Split-Path -Parent $PSScriptRoot
$origen = Join-Path $raiz 'assets\marca\LOGO-IBERIA.jpg'
$destinoPublico = Join-Path $raiz 'public\marca'
$destinoApp = Join-Path $raiz 'app'

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

# --- Logo completo, rojo y blanco -------------------------------------------
# Ojo: los nombres de variable en PowerShell no distinguen mayúsculas, así que
# los bitmaps llevan prefijo `bmp` para no pisar $ROJO (el color de marca).
$bmpRojo = Recortar (Convertir $master $LOGO_COMPLETO 1400 $ROJO) 2
Guardar $bmpRojo (Join-Path $destinoPublico 'iberia.png')

$bmpBlanco = Recortar (Convertir $master $LOGO_COMPLETO 1400 ([System.Drawing.Color]::White)) 2
Guardar $bmpBlanco (Join-Path $destinoPublico 'iberia-blanco.png')

# --- Solo la onda, en blanco: es la forma que aguanta tamaños pequeños ------
$bmpOnda = Recortar (Convertir $master $SOLO_ONDA 900 ([System.Drawing.Color]::White)) 1
Guardar $bmpOnda (Join-Path $destinoPublico 'iberia-onda-blanca.png')

# --- Icono de la app: baldosa roja con "IB" en blanco ----------------------
$bmpIB = Recortar (Convertir $master $LETRAS_IB 900 ([System.Drawing.Color]::White)) 1

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

$anchoIB = [int]($LADO * 0.72)
$altoIB = [int][math]::Round($bmpIB.Height * ($anchoIB / $bmpIB.Width))
$g.DrawImage($bmpIB, [int](($LADO - $anchoIB) / 2), [int](($LADO - $altoIB) / 2), $anchoIB, $altoIB)
$g.Dispose()
Guardar $icono (Join-Path $destinoApp 'icon.png')

foreach ($b in @($bmpRojo, $bmpBlanco, $bmpOnda, $bmpIB, $icono, $master)) { $b.Dispose() }
Write-Host "`nListo.`n"
