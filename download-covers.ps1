$dir = Join-Path $PSScriptRoot 'covers'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$UA = 'GameTrackerBot/1.0 (contact: robson@formahomolog.com.br)'

function Steam($id){
  @(
    "https://cdn.cloudflare.steamstatic.com/steam/apps/$id/library_600x900.jpg",
    "https://cdn.cloudflare.steamstatic.com/steam/apps/$id/header.jpg"
  )
}
function Wiki($path){ ,@("https://upload.wikimedia.org/wikipedia/en/thumb/$path") }

# slug => ordered candidate URLs (first that yields a real image wins)
$games = [ordered]@{
  'alan-wake-2'   = (Wiki 'e/ed/Alan_Wake_2_box_art.jpg/250px-Alan_Wake_2_box_art.jpg')
  're7'           = (Steam 418370)
  'lara-croft-go' = (Steam 540840)
  'tr1'           = (Wiki '6/69/Tomb_Raider_%281996%29.png/250px-Tomb_Raider_%281996%29.png')
  're-rev'        = (Steam 222480)
  'tr2'           = (Wiki 'd/d4/Tomb_Raider_II.png/250px-Tomb_Raider_II.png')
  're0'           = (Steam 339340)
  'uncharted-2'   = (Wiki '7/7b/Uncharted_2_box_artwork.jpg/250px-Uncharted_2_box_artwork.jpg')
  'tr3'           = (Wiki 'c/c8/Tomb_Raider_III.png/250px-Tomb_Raider_III.png')
  're1'           = (Steam 304240)
  'uncharted-3'   = (Wiki '0/02/Uncharted_3_Boxart.jpg/250px-Uncharted_3_Boxart.jpg')
  'tr4'           = (Wiki 'a/aa/Tomb_Raider_-_The_Last_Revelation.png/250px-Tomb_Raider_-_The_Last_Revelation.png')
  'gta3'          = (Steam 12100)
  're5'           = (Steam 21690)
  'tr5'           = (Wiki '3/3f/Tomb_Raider_-_Chronicles.png/250px-Tomb_Raider_-_Chronicles.png')
  'gta-vc'        = (Steam 12110)
  're6'           = (Steam 221040)
  'tr6'           = (Wiki '3/37/Tomb_Raider_-_The_Angel_of_Darkness.png/250px-Tomb_Raider_-_The_Angel_of_Darkness.png')
  'mafia-3'       = (Steam 360430)
  'gta-sa'        = (Steam 12120)
  'gta-5'         = (Steam 271590)
  'rdr2'          = (Steam 1174180)
}

foreach($slug in $games.Keys){
  $ok = $false
  foreach($url in $games[$slug]){
    $ext = if($url -match '\.png'){ 'png' } else { 'jpg' }
    $out = Join-Path $dir "$slug.$ext"
    $code = curl.exe -s -L -A $UA -o $out -w "%{http_code}" $url
    $len  = (Get-Item $out -ErrorAction SilentlyContinue).Length
    if($code -eq '200' -and $len -gt 3000){
      Write-Host ("PASS  {0,-14} {1,7} bytes" -f $slug,$len); $ok=$true; break
    } else { Remove-Item $out -Force -ErrorAction SilentlyContinue }
  }
  if(-not $ok){ Write-Host ("FAIL  {0,-14}" -f $slug) }
}
Write-Host ("`nTotal em covers/: " + (Get-ChildItem $dir).Count + " arquivos")
