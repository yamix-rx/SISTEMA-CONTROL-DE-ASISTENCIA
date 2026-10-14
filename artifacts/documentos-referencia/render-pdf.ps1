param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [int]$FirstPage = 1,
  [int]$LastPage = 0,
  [int]$Width = 900
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfPageRenderOptions, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
$taskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$actionMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
function Await-Operation($Operation, $ResultType) {
  $task = $taskMethod.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.GetAwaiter().GetResult()
}
function Await-Action($Action) {
  $task = $actionMethod.Invoke($null, @($Action))
  $task.GetAwaiter().GetResult()
}
$source = (Resolve-Path -LiteralPath $InputPath).Path
$destination = [IO.Path]::GetFullPath($OutputDirectory)
[IO.Directory]::CreateDirectory($destination) | Out-Null
$file = Await-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($source)) ([Windows.Storage.StorageFile])
$pdf = Await-Operation ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
$last = if ($LastPage -gt 0) { [Math]::Min($LastPage, $pdf.PageCount) } else { $pdf.PageCount }
for ($pageNumber = $FirstPage; $pageNumber -le $last; $pageNumber++) {
  $page = $pdf.GetPage([uint32]($pageNumber - 1))
  $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  $options = New-Object Windows.Data.Pdf.PdfPageRenderOptions
  $options.DestinationWidth = [uint32]$Width
  Await-Action ($page.RenderToStreamAsync($stream, $options)) | Out-Null
  $stream.Seek(0)
  $readStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
  $outputPath = Join-Path $destination ('page-{0:D2}.png' -f $pageNumber)
  $outputFile = [IO.File]::Create($outputPath)
  $readStream.CopyTo($outputFile)
  $outputFile.Dispose()
  $readStream.Dispose()
  $stream.Dispose()
  $page.Dispose()
  Write-Output $outputPath
}
