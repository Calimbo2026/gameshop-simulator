# Mapa 3D, paisajes regionales, vista previa de niveles en Mejoras y final con mapa encendido.
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width':900,'height':820})).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://'+ROOT+'/dist/index.html'); await pg.wait_for_timeout(1200)
        await pg.evaluate("GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto'}); GS.Store.set('days',13); GS.Store.set('introSeen',true); GS.Store.set('fondo',1700); GS.Store.set('coins',157); GS.Store.set('branches',{pampeana:{open:1},cuyo:{open:1,staff:['maru','flor'],up:{cartel:2,mesa:1},rep:4.4,train:1,days:3,manager:'Maru'}})")
        await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.click('#btnPlot'); await pg.wait_for_timeout(1200); await pg.screenshot(path=ROOT+'/shots/19_mapa.png')
        bx = await pg.evaluate("JSON.stringify(document.getElementById('mapCv').getBoundingClientRect())"); import json; r=json.loads(bx)
        seen=set()
        for fy in [x/20 for x in range(2,19)]:
            for fx in [x/20 for x in range(5,16)]:
                await pg.mouse.click(r['x']+r['width']*fx, r['y']+r['height']*fy); t=(await pg.inner_text('#mapCard'))[:22].split('\n')[0]; seen.add(t)
                if 'Cuyo' in t: break
            if any('Cuyo' in t for t in seen): break
        print('regiones tocadas:', seen); await pg.screenshot(path=ROOT+'/shots/19_mapa.png')
        await pg.click('[data-go="cuyo"]'); await pg.wait_for_timeout(500)
        mg = await pg.query_selector('[data-mg]')
        if mg: await mg.click(); await pg.wait_for_timeout(600)
        for reg in ['cuyo','noa','nea','patagonia']:
            await pg.evaluate("(()=>{const b=GS.Store.get('branches'); b['%s']=b['%s']||{open:1,staff:[],up:{},rep:4.2}; GS.Store.set('branches',b); GS.Store.set('branch','%s'); GS.Store.set('up',{}); GS.Store.set('rep',4.2)})()" % (reg,reg,reg))
            await pg.reload(); await pg.wait_for_timeout(1500)
            await pg.evaluate("document.getElementById('start').hidden=true; GS.World.showAll()"); await pg.wait_for_timeout(1500); await pg.screenshot(path=ROOT+'/shots/19_%s.png' % reg)
        await pg.evaluate("GS.Store.set('branch','pampeana'); GS.Store.set('up',{})"); await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.getElementById('start').hidden=true; GS.World.showAll()"); await pg.wait_for_timeout(1200); await pg.screenshot(path=ROOT+'/shots/19_pampeana.png')
        await pg.evaluate("document.getElementById('start').hidden=false"); await pg.click('#btnShop'); await pg.wait_for_timeout(500)
        await pg.evaluate("[...document.querySelectorAll('.slotb')].find(b=>/Flota/.test(b.textContent)).click()"); await pg.wait_for_timeout(500)
        cs = await pg.query_selector_all('#shopCards .card'); await cs[2].click(); await pg.wait_for_timeout(1500); await pg.screenshot(path=ROOT+'/shots/19_camion.png')
        print('coins', await pg.evaluate("GS.Store.get('coins')"), 'up', await pg.evaluate("JSON.stringify(GS.Store.get('up'))"))
        await pg.evaluate("GS.Game.goHome && document.querySelector('#shop .btn, #shopDone, #shopClose') "); 
        print('errores:', errs)
asyncio.run(main())
