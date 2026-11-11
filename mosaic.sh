#!/bin/bash
mkdir -p "$(dirname "$0")/live"
exec ffmpeg -hide_banner -loglevel warning -fflags +genpts \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/praiaguinchosul/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/crismina/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/praiadospescadores/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/bcpescadores/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/conceicao/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/tamariz/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/bctamarizfixa/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/praiadasavencas/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/parede/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/carcavelos/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/carcavelos2/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/bccarcavelosnortefixa/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/bccarcaveloscalhaufixa/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/matadouroskatepark/playlist.m3u8' \
  -hwaccel cuda -hwaccel_output_format cuda -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i 'https://video-auth1.iol.pt/beachcam/matadouroskate/playlist.m3u8' \
  -filter_complex "[0:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v0];[1:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v1];[2:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v2];[3:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v3];[4:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v4];[5:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v5];[6:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v6];[7:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v7];[8:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v8];[9:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v9];[10:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v10];[11:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v11];[12:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v12];[13:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v13];[14:v]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[v14];[v0][v1][v2][v3][v4][v5][v6][v7][v8][v9][v10][v11][v12][v13][v14]xstack=inputs=15:layout=0_0|320_0|640_0|960_0|1280_0|0_180|320_180|640_180|960_180|1280_180|0_360|320_360|640_360|960_360|1280_360,fps=25,format=nv12,hwupload_cuda[out]" \
  -map "[out]" -c:v h264_nvenc -preset p1 -tune ll -g 50 -an \
  -f hls -hls_time 2 -hls_list_size 5 -hls_flags delete_segments+independent_segments \
  -hls_segment_filename "$(dirname "$0")/live/seg_%05d.ts" "$(dirname "$0")/live/mosaic.m3u8"
