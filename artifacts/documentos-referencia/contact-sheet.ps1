param(
  [string]$RootDirectory = $PSScriptRoot,
  [string]$OutputFile = (Join-Path $PSScriptRoot 'cartas-originales.png')
)
Add-Type -AssemblyName System.Drawing
$names = @('sbss', 'nanas', 'silsan', 'ong', 'camara')
$bitmap = New-Object System.Drawing.Bitmap(1380, 1350)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::FromArgb(235, 235, 235))
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$font = New-Object System.Drawing.Font('Arial', 16)
for ($index = 0; $index -lt $names.Count; $index++) {
  $source = Join-Path $RootDirectory ('carta-' + $names[$index] + '/page-01.png')
  $image = [System.Drawing.Image]::FromFile($source)
  $x = ($index % 3) * 460 + 5
  $y = [Math]::Floor($index / 3) * 675
  $graphics.DrawString($names[$index].ToUpperInvariant(), $font, [System.Drawing.Brushes]::Black, $x + 5, $y + 3)
  $graphics.DrawImage($image, $x, $y + 30, 450, [int](450 * $image.Height / $image.Width))
  $image.Dispose()
}
$bitmap.Save([IO.Path]::GetFullPath($OutputFile), [System.Drawing.Imaging.ImageFormat]::Png)
$font.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
Write-Output ([IO.Path]::GetFullPath($OutputFile))
