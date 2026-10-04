#!/usr/bin/env bash
# Encoding der Bildsequenz mit Tonmischung, Untertitelspur und eingebrannter Fassung.
set -euo pipefail
cd "$(dirname "$0")/.."
FR=30
SEQ=out/final/f%05d.jpg
mkdir -p output/audio
# Stems und Mischungen verlustfrei als FLAC (24 bit, 48 kHz)
for n in stem_sprecher stem_musik stem_sfx mix mix_ohne_sprecher; do
  ffmpeg -y -loglevel error -i "audio/out/$n.wav" -c:a flac -sample_fmt s32 "output/audio/$n.flac"
done

# Hauptfassung: H.264 High, CRF 19, AAC 256 kbit/s, Untertitel als zuschaltbare Spur (mov_text)
ffmpeg -y -loglevel error -framerate $FR -i "$SEQ" -i audio/out/mix.wav -i output/ip3_Erklaervideo_DE.srt \
  -map 0:v -map 1:a -map 2:s \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -x264-params "keyint=60:min-keyint=30" -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 256k -ar 48000 -c:s mov_text -metadata:s:s:0 language=ger -metadata:s:a:0 language=ger \
  -metadata title="ip³ Energietechnik GmbH · Wer regelt Ihren Solarpark?" -movflags +faststart \
  output/ip3_Erklaervideo_16x9.mp4

# Fassung mit eingebrannten Untertiteln (Markenschrift über fontconfig/fontsdir)
ffmpeg -y -loglevel error -framerate $FR -i "$SEQ" -i audio/out/mix.wav \
  -vf "subtitles=output/ip3_Erklaervideo_DE_einbrennen.ass:fontsdir=engine/assets/fonts" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart \
  output/ip3_Erklaervideo_16x9_UT.mp4

ls -la output/*.mp4
