Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconPath = Join-Path $root 'build\icon.ico'
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = @()

function New-AstralisBitmap([int]$size) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $scale = $size / 128.0
  $margin = [Math]::Max(1, [int](6 * $scale))
  $orbitalPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(235, 114, 223, 240), [Math]::Max(1, 2.4 * $scale))
  $starBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 224, 237, 255))
  $violetBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 193, 176, 255))
  $baseBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 18, 24, 39))

  $graphics.FillEllipse($baseBrush, $margin, $margin, $size - (2 * $margin), $size - (2 * $margin))
  $graphics.TranslateTransform($size / 2, $size / 2)
  $graphics.RotateTransform(-28)
  $graphics.DrawEllipse($orbitalPen, -47 * $scale, -28 * $scale, 94 * $scale, 56 * $scale)
  $graphics.ResetTransform()

  $center = $size / 2
  $main = @(
    [System.Drawing.PointF]::new($center, 15 * $scale),
    [System.Drawing.PointF]::new(68 * $scale, 38 * $scale),
    [System.Drawing.PointF]::new(91 * $scale, 41 * $scale),
    [System.Drawing.PointF]::new(68 * $scale, 45 * $scale),
    [System.Drawing.PointF]::new($center, 68 * $scale),
    [System.Drawing.PointF]::new(60 * $scale, 45 * $scale),
    [System.Drawing.PointF]::new(37 * $scale, 41 * $scale),
    [System.Drawing.PointF]::new(60 * $scale, 38 * $scale)
  )
  $graphics.FillPolygon($starBrush, $main)

  if ($size -ge 24) {
    $small = @(
      [System.Drawing.PointF]::new(90 * $scale, 67 * $scale),
      [System.Drawing.PointF]::new(94 * $scale, 78 * $scale),
      [System.Drawing.PointF]::new(105 * $scale, 82 * $scale),
      [System.Drawing.PointF]::new(94 * $scale, 86 * $scale),
      [System.Drawing.PointF]::new(90 * $scale, 97 * $scale),
      [System.Drawing.PointF]::new(86 * $scale, 86 * $scale),
      [System.Drawing.PointF]::new(75 * $scale, 82 * $scale),
      [System.Drawing.PointF]::new(86 * $scale, 78 * $scale)
    )
    $graphics.FillPolygon($violetBrush, $small)
  }

  $graphics.Dispose()
  $orbitalPen.Dispose()
  $starBrush.Dispose()
  $violetBrush.Dispose()
  $baseBrush.Dispose()
  return $bitmap
}

foreach ($size in $sizes) {
  $bitmap = New-AstralisBitmap $size
  $lock = $bitmap.LockBits([System.Drawing.Rectangle]::new(0, 0, $size, $size), [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $pixelBytes = [byte[]]::new($size * $size * 4)
  [Runtime.InteropServices.Marshal]::Copy($lock.Scan0, $pixelBytes, 0, $pixelBytes.Length)
  $bitmap.UnlockBits($lock)
  $bitmap.Dispose()

  $maskStride = [int]([Math]::Ceiling($size / 32.0) * 4)
  $mask = [byte[]]::new($maskStride * $size)

  $dib = New-Object IO.MemoryStream
  $writer = New-Object IO.BinaryWriter($dib)
  $writer.Write([UInt32]40); $writer.Write([Int32]$size); $writer.Write([Int32]($size * 2))
  $writer.Write([UInt16]1); $writer.Write([UInt16]32); $writer.Write([UInt32]0)
  $writer.Write([UInt32]($pixelBytes.Length + $mask.Length)); $writer.Write([Int32]0); $writer.Write([Int32]0)
  $writer.Write([UInt32]0); $writer.Write([UInt32]0)
  for ($row = $size - 1; $row -ge 0; $row--) {
    $writer.Write($pixelBytes, $row * $size * 4, $size * 4)
  }
  $writer.Write($mask)
  $writer.Flush()
  $images += [PSCustomObject]@{ Size = $size; Bytes = $dib.ToArray() }
  $writer.Dispose(); $dib.Dispose()
}

$headerSize = 6 + (16 * $images.Count)
$stream = New-Object IO.MemoryStream
$writer = New-Object IO.BinaryWriter($stream)
$writer.Write([UInt16]0); $writer.Write([UInt16]1); $writer.Write([UInt16]$images.Count)
$offset = $headerSize
foreach ($image in $images) {
  $dimension = if ($image.Size -eq 256) { 0 } else { $image.Size }
  $writer.Write([byte]$dimension); $writer.Write([byte]$dimension); $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([UInt16]1); $writer.Write([UInt16]32); $writer.Write([UInt32]$image.Bytes.Length); $writer.Write([UInt32]$offset)
  $offset += $image.Bytes.Length
}
foreach ($image in $images) { $writer.Write([byte[]]$image.Bytes) }
$writer.Flush()
[IO.File]::WriteAllBytes($iconPath, $stream.ToArray())
$writer.Dispose(); $stream.Dispose()
Write-Output "Ícone Windows criado em $iconPath"
