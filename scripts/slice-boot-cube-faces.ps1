# Slice isometric loader art into six square face textures for CSS cube mapping.
Add-Type -AssemblyName System.Drawing

$root = "E:\Da-Music-Box-v4-SOURCE-COMPLETE"
$srcPath = Join-Path $root "public\splash\da-muzik-box-loader.png"
$outDir = Join-Path $root "public\splash\cube-faces"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$src = [System.Drawing.Image]::FromFile($srcPath)
$size = 512

function Save-Face([System.Drawing.Bitmap]$bitmap, [string]$name) {
    $path = Join-Path $outDir "$name.jpg"
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    Write-Host "Wrote $path"
}

function Flip-X([System.Drawing.Bitmap]$bitmap) {
    $clone = $bitmap.Clone()
    $clone.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX)
    return $clone
}

function Flip-Y([System.Drawing.Bitmap]$bitmap) {
    $clone = $bitmap.Clone()
    $clone.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipY)
    return $clone
}

function Crop([int]$x, [int]$y, [int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $dest = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $srcRect = New-Object System.Drawing.Rectangle $x, $y, $w, $h
    $g.DrawImage($src, $dest, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    return $bmp
}

# Slightly wider crops — extra gold at face edges for corner wrap.
$front = Crop 205 311 260 260
$right = Crop 535 311 260 260
$top = Crop 382 105 260 260
$back = Flip-X $front
$left = Flip-X $right
$bottom = Flip-Y $top

Save-Face $front "front"
Save-Face $back "back"
Save-Face $right "right"
Save-Face $left "left"
Save-Face $top "top"
Save-Face $bottom "bottom"

$front.Dispose()
$right.Dispose()
$top.Dispose()
$back.Dispose()
$left.Dispose()
$bottom.Dispose()
$src.Dispose()
Write-Host "Done."
