# Etapas 7 y 8: final (vista previa y real), Nuevo Juego+ con modificador.
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width':420,'height':900})).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://'+ROOT+'/dist/index.html'); await pg.wait_for_timeout(1200)
        await pg.evaluate("""(()=>{const up={}; GS.UPGRADES.forEach(g=>up[g.id]=g.levels.length); const h={}; GS.STORIES.forEach(S=>h[S.id]={done:1,step:9,last:1,notes:[],flags:{}}); const br={};
          GS.REGIONS.forEach(r=>br[r.id]={open:1,up,rep:5,staff:r.crew?[r.crew[0].id,r.crew[1].id]:[],manager:'X'});
          GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto'}); GS.Store.set('days',38); GS.Store.set('introSeen',true); GS.Store.set('quality','baja'); GS.Store.set('up',up); GS.Store.set('rep',5); GS.Store.set('hist',h); GS.Store.set('branches',br); GS.Store.set('cos',{casco:1}); GS.Store.set('ach',['primera']);
          GS.Store.set('tot',{c:230,d:38,perfect:4,vueltoMal:1})})()""")
        await pg.reload(); await pg.wait_for_timeout(1500)
        print('progreso:', await pg.evaluate("document.getElementById('btnPlot').innerText"))
        await pg.click('#btnOpts'); await pg.wait_for_timeout(300); await pg.click('#optFinal'); await pg.wait_for_timeout(600)
        await pg.screenshot(path=ROOT+'/shots/18_final.png')
        await pg.click('#finNg'); await pg.wait_for_timeout(300); await pg.screenshot(path=ROOT+'/shots/18_ngplus.png')
        await pg.click('[data-mod="apuro"]'); await pg.wait_for_timeout(600)
        print(await pg.evaluate("JSON.stringify({days:GS.Store.get('days'),mod:GS.Store.get('mod'),ngp:GS.Store.get('ngp'),cos:GS.Store.get('cos'),ach:GS.Store.get('ach'),br:GS.Store.get('branches'),up:GS.Store.get('up'),rank:document.getElementById('rankT').textContent, store:document.getElementById('btnStore').hidden})"), errs)
asyncio.run(main())
