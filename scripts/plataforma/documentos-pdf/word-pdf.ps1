param([string]$Lista, [string]$Base, [string]$Salida, [int]$Optimizar = 1)
# Convierte a PDF con Word (doc, docx, dot, rtf) o Excel (xls, xlsx). Lista: «origen<TAB>nombre_salida» por renglón.
# $Optimizar = 1 → wdExportOptimizeForOnScreen (baja las imágenes); 0 → para imprimir.
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $Salida | Out-Null
$word = $null; $excel = $null; $ppt = $null
$tanda = [IO.Path]::GetFileNameWithoutExtension($Lista)
$registro = Join-Path $Salida ('_registro-' + $tanda + '.tsv')
# Lo que ya falló (incluido lo que el vigilante tuvo que matar) no se reintenta: se revisa aparte.
$fallidos = @{}
if (Test-Path $registro) { foreach ($l in Get-Content $registro) { $p = $l -split "`t"; if ($p[0] -eq 'error') { $fallidos[$p[1]] = 1 } } }
Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices;
public class VentanaWord { public delegate bool CB(IntPtr h, IntPtr l);
 [DllImport("user32.dll")] static extern bool EnumWindows(CB cb, IntPtr l);
 [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
 public static uint Pid(string titulo) { uint r = 0; EnumWindows((h, l) => { var s = new StringBuilder(256); GetWindowText(h, s, 256); if (s.ToString().Contains(titulo)) { GetWindowThreadProcessId(h, out r); return false; } return true; }, IntPtr.Zero); return r; } }
'@
$res = @()
foreach ($linea in Get-Content -Encoding UTF8 $Lista) {
  $partes = $linea -split "`t"
  $src = Join-Path $Base $partes[0]
  $dst = Join-Path $Salida $partes[1]
  if (Test-Path -LiteralPath $dst) { continue }
  if ($fallidos.ContainsKey($partes[0])) { continue }
  $ext = [IO.Path]::GetExtension($src).ToLower()
  $t = Get-Date
  # Para el vigilante: qué archivo empezó y cuándo (si pasa del tope, mata a este Word y aquí cae en el catch).
  Add-Content -Encoding UTF8 $registro "inicio`t$($partes[0])`t$($t.ToString('o'))"
  try {
    if ($ext -in '.doc', '.docx', '.dot', '.rtf') {
      if (-not $word) {
        $word = New-Object -ComObject Word.Application
        # Un título único por tanda para hallar su proceso (el vigilante lo mata si un archivo se traba).
        $word.Caption = "conv-$tanda"
        Start-Sleep -Milliseconds 300
        Set-Content -Path ($registro + '.pid') -Value ([VentanaWord]::Pid("conv-$tanda"))
 $word.Visible = $false; $word.DisplayAlerts = 0; $word.AutomationSecurity = 3; $word.Options.UpdateFieldsAtPrint = $false; $word.Options.UpdateLinksAtPrint = $false; $word.Options.UpdateLinksAtOpen = $false }
      # Con una clave inventada, un archivo protegido falla en vez de abrir un diálogo que cuelga a Word.
      $doc = $word.Documents.Open($src, $false, $true, $false, 'sin-clave', 'sin-clave', $true, 'sin-clave', 'sin-clave', 0, 0, $false, $true)
      # Los campos de fecha del día (DATE 31, TIME 32, PRINTDATE 23) Word los rehace al abrir: una «Elaboración» con
      # campo TIME salía con la fecha de la conversión. Se les pone la fecha en que se guardó el archivo, con su
      # formato, y se congelan. PAGE y NUMPAGES siguen vivos.
      $guardado = (Get-Item -LiteralPath $src).LastWriteTime
      try {
        $props = $doc.BuiltInDocumentProperties
        $p = [System.__ComObject].InvokeMember('Item', [Reflection.BindingFlags]::GetProperty, $null, $props, @('Last save time'))
        $v = [System.__ComObject].InvokeMember('Value', [Reflection.BindingFlags]::GetProperty, $null, $p, $null)
        if ($v -is [datetime] -and $v.Year -gt 1990) { $guardado = $v }
      } catch {}
      foreach ($historia in $doc.StoryRanges) {
        $r = $historia
        while ($r) {
          # Recorrer campo por campo por COM es lento: en el cuerpo de un manual con miles (índice, referencias) se
          # quedaba minutos. Encabezados y pies, siempre; el cuerpo, solo si tiene pocos.
          $n = $r.Fields.Count
          if ($n -eq 0 -or ($r.StoryType -eq 1 -and $n -gt 150)) { $r = $r.NextStoryRange; continue }
          foreach ($f in $r.Fields) {
            # Vínculos a archivos de la red de Iberia (LINK, INCLUDEPICTURE, INCLUDETEXT): se queda lo guardado.
            if ($f.Type -in 56, 67, 68) { $f.Locked = $true; continue }
            if ($f.Type -in 31, 32, 23) {
              $formato = 'dd/MM/yyyy'
              if ($f.Code.Text -match '\\@\s*"([^"]+)"') { $formato = $Matches[1] -replace 'AM/PM', 'tt' -replace 'am/pm', 'tt' }
              try { $texto = $guardado.ToString($formato, [Globalization.CultureInfo]'es-VE') } catch { $texto = $guardado.ToString('dd/MM/yyyy') }
              $f.Result.Text = $texto
              $f.Locked = $true
              $script:fechas++
            }
          }
          $r = $r.NextStoryRange
        }
      }
      $doc.ExportAsFixedFormat($dst, 17, $false, $Optimizar, 0, 1, 1, 0, $false, $true, 0, $false, $true, $false)
      $doc.Close([ref]0)
    } elseif ($ext -in '.xls', '.xlsx') {
      if (-not $excel) { $excel = New-Object -ComObject Excel.Application; $excel.Visible = $false; $excel.DisplayAlerts = $false; $excel.AutomationSecurity = 3 }
      $wb = $excel.Workbooks.Open($src, 0, $true, [Type]::Missing, 'sin-clave', 'sin-clave', $true)
      $wb.ExportAsFixedFormat(0, $dst, $Optimizar)
      $wb.Close($false)
    } elseif ($ext -in '.ppt', '.pptx') {
      if (-not $ppt) { $ppt = New-Object -ComObject PowerPoint.Application; $ppt.DisplayAlerts = 1 }
      $pres = $ppt.Presentations.Open($src + '::sin-clave', -1, 0, 0)
      $pres.SaveAs($dst, 32)
      $pres.Close()
    } else { continue }
    Add-Content -Encoding UTF8 $registro "ok`t$($partes[0])`t$([math]::Round(((Get-Date) - $t).TotalSeconds, 1))`t$script:fechas"
    $script:fechas = 0
  } catch {
    Add-Content -Encoding UTF8 $registro "error`t$($partes[0])`t$($_.Exception.Message -replace '\s+', ' ')"
    try { if ($doc) { $doc.Close([ref]0) } } catch {}
    # Tras un error (o si el vigilante mató a Word) se cierra todo y se levanta de nuevo para el siguiente: leer una
    # propiedad de un objeto COM muerto en PowerShell no falla, devuelve nulo, así que no hay forma fiable de saberlo.
    foreach ($app in @($word, $excel, $ppt)) { if ($app) { try { $app.Quit() } catch {} } }
    $word = $null; $excel = $null; $ppt = $null
  }
  $doc = $null; $wb = $null
}
if ($word) { $word.Quit() }
if ($excel) { $excel.Quit() }
if ($ppt) { $ppt.Quit() }
Add-Content -Encoding UTF8 $registro 'fin'
