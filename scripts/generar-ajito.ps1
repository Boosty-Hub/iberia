<#
    Genera el asset web de Ajito a partir del arte que mandó la agencia.

        pwsh scripts/generar-ajito.ps1

    Requiere Windows (usa GDI+ vía System.Drawing). El PNG resultante se
    commitea, así que este script solo hace falta si la agencia manda arte nuevo.

    Entrada:  assets/marca/ajito.png   (Ajito centrado sobre fondo gris plano)
    Salida:   public/marca/ajito.png   (recortado al trazo, con alfa)

    El arte viene de la lámina 1920x1080 de la presentación «LOGOS IBERIA + IA»:
    Ajito centrado sobre un gris plano. Aquí se detecta ese gris por la esquina,
    se recorta a la figura y se reconstruye el alfa. La sombra bajo la ruedita
    se conserva a medio alfa: le da peso al personaje sobre tarjeta blanca.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$raiz = Split-Path -Parent $PSScriptRoot
$origen = Join-Path $raiz 'assets\marca\ajito.png'
$destino = Join-Path $raiz 'public\marca\ajito.png'

if (-not (Test-Path -LiteralPath $origen)) {
    throw @"
No se encontró el máster: $origen

Sácalo de la presentación de la agencia:
  1. Renombra 'LOGOS IBERIA + IA.pptx' a .zip y descomprímelo.
  2. Copia ppt/media/image2.png a assets/marca/ajito.png
"@
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destino) | Out-Null

# Cuánto puede alejarse un píxel del gris de fondo y seguir siendo fondo.
$TOLERANCIA = 18
# Margen que se deja alrededor de la figura, en píxeles del original.
$MARGEN = 12
# Lado del PNG de salida. Ajito se usa a 56-80 px; 512 cubre pantallas densas.
$LADO = 512

$fuente = [System.Drawing.Bitmap]::new($origen)
try {
    # El fondo es el color de la esquina: la lámina es un gris plano.
    $fondo = $fuente.GetPixel(2, 2)

    function EsFondo([System.Drawing.Color] $c) {
        return ([math]::Abs($c.R - $fondo.R) -le $TOLERANCIA) -and
               ([math]::Abs($c.G - $fondo.G) -le $TOLERANCIA) -and
               ([math]::Abs($c.B - $fondo.B) -le $TOLERANCIA)
    }

    # --- Recorte -------------------------------------------------------------
    # No sirve el simple mínimo y máximo de píxeles con tinta: la lámina trae el
    # RIF impreso en vertical contra el borde derecho, y eso estira la caja
    # hasta dejar a Ajito diminuto en una esquina. Se toma la RACHA MÁS LARGA de
    # filas y de columnas con tinta, que es el personaje; el RIF queda como una
    # racha aparte, corta y suelta, y se descarta.
    $colProfile = New-Object 'int[]' $fuente.Width
    $filProfile = New-Object 'int[]' $fuente.Height

    for ($y = 0; $y -lt $fuente.Height; $y++) {
        for ($x = 0; $x -lt $fuente.Width; $x++) {
            if (-not (EsFondo $fuente.GetPixel($x, $y))) {
                $colProfile[$x]++
                $filProfile[$y]++
            }
        }
    }

    function RachaMasLarga {
        <#  Extremos de la racha contigua más larga por encima del umbral. #>
        param([int[]] $Perfil, [int] $Umbral)

        $mejorInicio = -1; $mejorLargo = 0
        $inicio = -1
        for ($i = 0; $i -lt $Perfil.Length; $i++) {
            if ($Perfil[$i] -gt $Umbral) {
                if ($inicio -lt 0) { $inicio = $i }
            } elseif ($inicio -ge 0) {
                if (($i - $inicio) -gt $mejorLargo) { $mejorLargo = $i - $inicio; $mejorInicio = $inicio }
                $inicio = -1
            }
        }
        if ($inicio -ge 0 -and ($Perfil.Length - $inicio) -gt $mejorLargo) {
            $mejorLargo = $Perfil.Length - $inicio; $mejorInicio = $inicio
        }
        if ($mejorInicio -lt 0) { throw 'No se encontró figura: todo el arte es del color de fondo.' }
        # Los paréntesis del segundo elemento no sobran: en PowerShell la coma
        # liga más fuerte que la suma, así que `@($a, $a + $b - 1)` se parsearía
        # como `@($a, $a) + $b - 1` y revienta restándole 1 a un arreglo.
        return @($mejorInicio, ($mejorInicio + $mejorLargo - 1))
    }

    # Un par de píxeles sueltos en una línea son ruido de compresión, no figura.
    $rangoX = RachaMasLarga -Perfil $colProfile -Umbral 3
    $rangoY = RachaMasLarga -Perfil $filProfile -Umbral 3

    $minX = $rangoX[0]; $maxX = $rangoX[1]
    $minY = $rangoY[0]; $maxY = $rangoY[1]

    $minX = [math]::Max(0, $minX - $MARGEN)
    $minY = [math]::Max(0, $minY - $MARGEN)
    $maxX = [math]::Min($fuente.Width - 1, $maxX + $MARGEN)
    $maxY = [math]::Min($fuente.Height - 1, $maxY + $MARGEN)

    # Cuadrado, para que quepa en un avatar sin deformarse. Un `object-contain`
    # sobre un recorte apaisado deja a Ajito flotando; mejor resolverlo aquí.
    $ancho = $maxX - $minX + 1
    $alto = $maxY - $minY + 1
    $lado = [math]::Max($ancho, $alto)
    $offsetX = $minX - [int](($lado - $ancho) / 2)
    $offsetY = $minY - [int](($lado - $alto) / 2)

    # --- Alfa: fondo fuera, figura dentro, y la sombra a medio camino --------
    $recorte = [System.Drawing.Bitmap]::new($lado, $lado, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        for ($y = 0; $y -lt $lado; $y++) {
            for ($x = 0; $x -lt $lado; $x++) {
                $sx = $offsetX + $x
                $sy = $offsetY + $y

                if ($sx -lt 0 -or $sy -lt 0 -or $sx -ge $fuente.Width -or $sy -ge $fuente.Height) {
                    $recorte.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
                    continue
                }

                $c = $fuente.GetPixel($sx, $sy)
                if (EsFondo $c) {
                    $recorte.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
                    continue
                }

                # Cuánto se aparta del fondo. Los píxeles del borde antialiasado
                # se apartan poco y quedan semitransparentes, que es lo que
                # evita el halo gris sobre tarjeta blanca.
                $lejania = [math]::Max([math]::Max(
                    [math]::Abs($c.R - $fondo.R),
                    [math]::Abs($c.G - $fondo.G)),
                    [math]::Abs($c.B - $fondo.B))

                $alfa = [math]::Min(255, [int](($lejania / 40.0) * 255))
                $recorte.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alfa, $c.R, $c.G, $c.B))
            }
        }

        $salida = [System.Drawing.Bitmap]::new($LADO, $LADO, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $g = [System.Drawing.Graphics]::FromImage($salida)
            try {
                $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $g.Clear([System.Drawing.Color]::Transparent)
                $g.DrawImage($recorte, 0, 0, $LADO, $LADO)
            } finally { $g.Dispose() }

            $salida.Save($destino, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $salida.Dispose() }
    } finally { $recorte.Dispose() }
} finally { $fuente.Dispose() }

Write-Output "Listo: $destino  ($LADO x $LADO, recortado de $($minX),$($minY))"
