param([string]$Salida, [int]$Tope = 150)
# Mata el Word de una tanda cuando un archivo pasa de $Tope segundos (la tanda lo anota como error y sigue).
while ($true) {
  $registros = Get-ChildItem (Join-Path $Salida '_registro-tanda-*.tsv') -ErrorAction SilentlyContinue
  $vivas = 0
  foreach ($r in $registros) {
    $ultima = Get-Content $r -Tail 1
    if ($ultima -eq 'fin') { continue }
    $vivas++
    $p = $ultima -split "`t"
    if ($p[0] -eq 'inicio' -and $p.Count -ge 3) {
      $seg = ((Get-Date) - [datetime]::Parse($p[2])).TotalSeconds
      if ($seg -gt $Tope -and (Test-Path ($r.FullName + '.pid'))) {
        $id = [int](Get-Content ($r.FullName + '.pid'))
        Add-Content -Encoding UTF8 (Join-Path $Salida '_vigilante.log') "$(Get-Date -Format s)`tmato Word $id`t$($p[1])"
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        Start-Sleep 5
      }
    }
  }
  if ($registros -and $vivas -eq 0) { break }
  Start-Sleep 15
}
