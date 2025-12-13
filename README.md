## Demo: https://www.youtube.com/watch?v=EzzcEL_1o9o


## front
cd r3f-virtual-girlfriend-backend
yarn
yarn dev

## back
cd r3f-virtual-girlfriend-backend
yarn
yarn dev

## Producción rápida

### Ubuntu 24+
chmod +x startAvatar.sh
./startAvatar.sh

### Windows (PowerShell)
Set-ExecutionPolicy -Scope Process Bypass -Force
.\startAvatar.ps1

Ambos scripts instalan dependencias, construyen el frontend y levantan pm2 con los servicios `renta4-back` y `renta4-front`.


## Descargar avatares de Ready Player me (https://studio.readyplayer.me/)
https://models.readyplayer.me/68d13d1f3240c0104230228d.glb

## añadir ?morphTargets=ARKit,Oculus Visemes
https://models.readyplayer.me/68d13d1f3240c0104230228d.glb?morphTargets=ARKit,Oculus Visemes

