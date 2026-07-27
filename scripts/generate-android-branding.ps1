[CmdletBinding()]
param(
  [switch]$LauncherOnly
)

Add-Type -AssemblyName System.Drawing

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$launcherIconPath = Join-Path $projectRoot "src\assets\logoicon.png"
$splashLogoPath = Join-Path $projectRoot "src\assets\086f960c8661a1671180afefed41bf6bef99edd4.png"

if (-not (Test-Path $launcherIconPath)) {
  throw "Ícone do launcher não encontrado em $launcherIconPath"
}

if (-not $LauncherOnly -and -not (Test-Path $splashLogoPath)) {
  throw "Logo da splash não encontrada em $splashLogoPath"
}

$launcherIcon = [System.Drawing.Image]::FromFile($launcherIconPath)
$splashLogo = if ($LauncherOnly) { $null } else { [System.Drawing.Image]::FromFile($splashLogoPath) }

function New-Color([string]$hex, [int]$alpha = 255) {
  $base = [System.Drawing.ColorTranslator]::FromHtml($hex)
  return [System.Drawing.Color]::FromArgb($alpha, $base.R, $base.G, $base.B)
}

function New-LauncherMark([System.Drawing.Image]$sourceImage) {
  $sourceBitmap = New-Object System.Drawing.Bitmap $sourceImage
  $markBitmap = New-Object System.Drawing.Bitmap $sourceBitmap.Width, $sourceBitmap.Height

  for ($y = 0; $y -lt $sourceBitmap.Height; $y++) {
    for ($x = 0; $x -lt $sourceBitmap.Width; $x++) {
      $pixel = $sourceBitmap.GetPixel($x, $y)
      $alpha = [int]([Math]::Round(([Math]::Max($pixel.R - 12, 0) / 243) * 255))

      if ($alpha -gt 0) {
        $markBitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
      }
    }
  }

  $sourceBitmap.Dispose()
  return $markBitmap
}

$launcherMark = New-LauncherMark $launcherIcon

function Get-ContainedSize([int]$sourceWidth, [int]$sourceHeight, [int]$maxWidth, [int]$maxHeight) {
  $ratioX = $maxWidth / [double]$sourceWidth
  $ratioY = $maxHeight / [double]$sourceHeight
  $ratio = [Math]::Min($ratioX, $ratioY)

  return @(
    [int]([Math]::Round($sourceWidth * $ratio)),
    [int]([Math]::Round($sourceHeight * $ratio))
  )
}

function Save-LauncherImage([int]$size, [string]$outputPath, [double]$scale = 0.78) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear((New-Color "#0153DD"))

  $iconSize = [int]($size * $scale)
  $iconX = [int](($size - $iconSize) / 2)
  $iconY = [int](($size - $iconSize) / 2)
  $graphics.DrawImage($launcherMark, $iconX, $iconY, $iconSize, $iconSize)

  $directory = Split-Path $outputPath -Parent
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }

  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Save-SplashLogo([int]$size, [string]$outputPath) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $targetSize = Get-ContainedSize -sourceWidth $splashLogo.Width -sourceHeight $splashLogo.Height -maxWidth ([int]($size * 0.78)) -maxHeight ([int]($size * 0.78))
  $iconWidth = $targetSize[0]
  $iconHeight = $targetSize[1]
  $iconX = [int](($size - $iconWidth) / 2)
  $iconY = [int](($size - $iconHeight) / 2)
  $graphics.DrawImage($splashLogo, $iconX, $iconY, $iconWidth, $iconHeight)

  $directory = Split-Path $outputPath -Parent
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }

  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Save-SplashBranding([int]$width, [int]$height, [string]$outputPath) {
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $footerFont = New-Object System.Drawing.Font("Segoe UI Semibold", 62, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $footer = "Raaberts Softwares"
  $footerSize = $graphics.MeasureString($footer, $footerFont)
  $footerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 255, 255, 255))

  $footerX = [int](($width - $footerSize.Width) / 2)
  $footerY = [int](($height - $footerSize.Height) / 2) - 4
  $graphics.DrawString($footer, $footerFont, $footerBrush, $footerX, $footerY)

  $directory = Split-Path $outputPath -Parent
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }

  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $footerBrush.Dispose()
  $footerFont.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Save-SplashImage([int]$width, [int]$height, [string]$outputPath) {
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $rect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
  $backgroundBrush = New-Object System.Drawing.SolidBrush (New-Color "#2563EB")
  $graphics.FillRectangle($backgroundBrush, $rect)

  $targetSize = Get-ContainedSize -sourceWidth $splashLogo.Width -sourceHeight $splashLogo.Height -maxWidth ([int]($width * 0.42)) -maxHeight ([int]($height * 0.28))
  $iconWidth = $targetSize[0]
  $iconHeight = $targetSize[1]
  $iconX = [int](($width - $iconWidth) / 2)
  $iconY = [int]($height * 0.18)

  $graphics.DrawImage($splashLogo, $iconX, $iconY, $iconWidth, $iconHeight)

  $titleFontSize = [Math]::Max([int]($width * 0.075), 34)
  $footerFontSize = [Math]::Max([int]($width * 0.038), 20)
  $titleFont = New-Object System.Drawing.Font("Segoe UI", $titleFontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $footerFont = New-Object System.Drawing.Font("Segoe UI Semibold", $footerFontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $footerBrush = New-Object System.Drawing.SolidBrush (New-Color "#FFFFFF" 230)

  $title = "Worko"
  $footer = "Raaberts Softwares"
  $titleSize = $graphics.MeasureString($title, $titleFont)
  $footerSize = $graphics.MeasureString($footer, $footerFont)

  $titleX = [int](($width - $titleSize.Width) / 2)
  $titleY = [int]($iconY + $iconHeight + ($height * 0.04))
  $footerX = [int](($width - $footerSize.Width) / 2)
  $footerY = [int]($height - $footerSize.Height - ($height * 0.08))

  $graphics.DrawString($title, $titleFont, $whiteBrush, $titleX, $titleY)
  $graphics.DrawString($footer, $footerFont, $footerBrush, $footerX, $footerY)

  $directory = Split-Path $outputPath -Parent
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }

  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $footerBrush.Dispose()
  $whiteBrush.Dispose()
  $titleFont.Dispose()
  $footerFont.Dispose()
  $backgroundBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$launcherSizes = @{
  "mipmap-mdpi" = 48
  "mipmap-hdpi" = 72
  "mipmap-xhdpi" = 96
  "mipmap-xxhdpi" = 144
  "mipmap-xxxhdpi" = 192
}

$foregroundSizes = @{
  "mipmap-mdpi" = 108
  "mipmap-hdpi" = 162
  "mipmap-xhdpi" = 216
  "mipmap-xxhdpi" = 324
  "mipmap-xxxhdpi" = 432
}

$portraitSplashSizes = @{
  "drawable-port-mdpi" = @(320, 480)
  "drawable-port-hdpi" = @(480, 800)
  "drawable-port-xhdpi" = @(720, 1280)
  "drawable-port-xxhdpi" = @(960, 1600)
  "drawable-port-xxxhdpi" = @(1280, 1920)
}

$landscapeSplashSizes = @{
  "drawable-land-mdpi" = @(480, 320)
  "drawable-land-hdpi" = @(800, 480)
  "drawable-land-xhdpi" = @(1280, 720)
  "drawable-land-xxhdpi" = @(1600, 960)
  "drawable-land-xxxhdpi" = @(1920, 1280)
}

foreach ($entry in $launcherSizes.GetEnumerator()) {
  $folder = Join-Path $projectRoot "android\app\src\main\res\$($entry.Key)"
  Save-LauncherImage -size $entry.Value -outputPath (Join-Path $folder "ic_launcher.png") -scale 0.64
  Save-LauncherImage -size $entry.Value -outputPath (Join-Path $folder "ic_launcher_round.png") -scale 0.64
}

foreach ($entry in $foregroundSizes.GetEnumerator()) {
  $folder = Join-Path $projectRoot "android\app\src\main\res\$($entry.Key)"
  Save-LauncherImage -size $entry.Value -outputPath (Join-Path $folder "ic_launcher_foreground.png") -scale 0.60
}

if (-not $LauncherOnly) {
  Save-SplashImage -width 1242 -height 2688 -outputPath (Join-Path $projectRoot "android\app\src\main\res\drawable\splash.png")
  Save-SplashLogo -size 360 -outputPath (Join-Path $projectRoot "android\app\src\main\res\drawable-nodpi\splash_logo.png")
  Save-SplashBranding -width 1200 -height 180 -outputPath (Join-Path $projectRoot "android\app\src\main\res\drawable-nodpi\splash_branding.png")

  foreach ($entry in $portraitSplashSizes.GetEnumerator()) {
    $size = $entry.Value
    Save-SplashImage -width $size[0] -height $size[1] -outputPath (Join-Path $projectRoot "android\app\src\main\res\$($entry.Key)\splash.png")
  }

  foreach ($entry in $landscapeSplashSizes.GetEnumerator()) {
    $size = $entry.Value
    Save-SplashImage -width $size[0] -height $size[1] -outputPath (Join-Path $projectRoot "android\app\src\main\res\$($entry.Key)\splash.png")
  }

  $splashLogo.Dispose()
}

$launcherIcon.Dispose()
$launcherMark.Dispose()
