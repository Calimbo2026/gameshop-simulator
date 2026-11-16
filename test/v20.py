# Vereda larga, techo al alejar, Malvinas (final oculto).
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL = """(()=>{const up={}; GS.UPGRADES.forEach(g=>up[g.id]=g.levels.length); const h={}; GS.STORIES.forEach(S=>{ if(S.reg!=='malvinas' || %s) h[S.id]={done:1,step:9,last:1,notes:[],flags:{}}}); const br={};
  GS.REGIONS.forEach(r=>{ if(!r.secret || %s) br[r.id]={open:1,up,rep:5,staff:r.crew?[r.crew[0].id,r.crew[1].id]:[],manager:'X'}});
  GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto'}); GS.Store.set('days',41); GS.Store.set('introSeen',true); GS.Store.set('up',up); GS.Store.set('rep',5); GS.Store.set('hist',h); GS.Store.set('branches',br); GS.Store.set('fondo',3500); GS.Store.set('finalN',1); GS.Store.set('branch','%s')})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width':900,'height':760})).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://'+ROOT+'/dist/index.html'); await pg.wait_for_timeout(1000)
        await pg.evaluate("GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto'}); GS.Store.set('days',5); GS.Store.set('introSeen',true)")
        await pg.reload(); await pg.wait_for_timeout(1500); await pg.evaluate("document.getElementById('start').hidden=true; GS.World.showAll()"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=ROOT+'/shots/20_vereda.png')
        await pg.mouse.move(450,380)
        for i in range(8): await pg.mouse.wheel(0,200); await pg.wait_for_timeout(60)
        await pg.wait_for_timeout(2500); await pg.screenshot(path=ROOT+'/shots/20_techo.png')
        await pg.mouse.wheel(0,-200); await pg.mouse.wheel(0,-200); await pg.wait_for_timeout(2500); await pg.screenshot(path=ROOT+'/shots/20_techo_abre.png')
        await pg.evaluate(FULL % ('false','false','pampeana')); await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.click('#btnPlot'); await pg.wait_for_timeout(1200); await pg.screenshot(path=ROOT+'/shots/20_mapa_malvinas.png')
        r = await pg.evaluate("(()=>{const r=document.getElementById('mapCv').getBoundingClientRect(); return [r.x,r.y,r.width,r.height]})()"); hit=''
        for fy in [x/40 for x in range(24,38)]:
            for fx in [x/40 for x in range(18,32)]:
                await pg.mouse.click(r[0]+r[2]*fx, r[1]+r[3]*fy); hit=(await pg.inner_text('#mapCard'))[:30]
                if 'Malvinas' in hit: break
            if 'Malvinas' in hit: break
        print('tarjeta:', hit.replace('\n',' | '))
        await pg.evaluate(FULL % ('true','true','malvinas')); await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.getElementById('start').hidden=true; GS.World.showAll()"); await pg.wait_for_timeout(1800); await pg.screenshot(path=ROOT+'/shots/20_malvinas.png')
        print('errores:', errs)
asyncio.run(main())
