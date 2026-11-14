# Modo carrera, Navidad, celular chico, lluvia y caja.  Uso: python3 test/v12.py
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        ctx = await b.new_context(viewport={'width': 360, 'height': 640}, has_touch=True, is_mobile=True); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        S = lambda f: pg.screenshot(path=f'{ROOT}/shots/12_{f}.png')
        await pg.goto('file://' + ROOT + '/dist/index.html'); await pg.wait_for_timeout(1000)
        await pg.evaluate("GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto',glasses:true}); GS.Store.set('quality','media'); GS.DEBUG_NOINTRO=1")
        await pg.reload(); await pg.wait_for_timeout(1000); await S('inicio')
        fit = await pg.evaluate("(()=>{const s=document.getElementById('start');return [s.scrollHeight, s.clientHeight]})()"); print('inicio alto/visible', fit)
        await pg.click('#btnPlay'); await pg.wait_for_timeout(1500); await S('placa1')
        for i in range(2, 5):
            await pg.click('#inNext'); await pg.wait_for_timeout(1700); await S(f'placa{i}')
        await pg.click('#inSkip'); await pg.wait_for_timeout(800)
        await pg.evaluate("GS.Game.goHome ? GS.Game.goHome() : 0"); await pg.wait_for_timeout(300)
        await pg.evaluate("GS.Store.set('days',9); GS.Store.set('coins',900); GS.Store.set('testCond','navidad'); GS.Store.set('xmas',{a:2,g:1,l:1}); GS.Store.set('seen',{mostrador:1,caja:1,whatsapp:1,cierre:1,repo:1,stock:1,vidriera:1,ml:1,proveedor:1,pc:1,service:1,devol:1,cord:1,adornos:1})")
        await pg.reload(); await pg.wait_for_timeout(1000); await S('inicio2')
        await pg.click('#btnShop'); await pg.wait_for_timeout(1200); await S('tienda'); await pg.click('#shopDone')
        await pg.click('#btnPlay'); await pg.wait_for_timeout(5000); await S('navidad')
        await pg.evaluate("GS.World.focusAt(1.5,-3.6,0.3,0)"); await pg.wait_for_timeout(1800); await S('gorritos')
        cu = "{arche:GS.CUSTOMERS[5], look:{shirt:0xb86fa8,hair:0xc9c9d6,hairStyle:'rodete',glasses:true,lips:true}, pat:0.8, product:GS.CATALOG.find(p=>p.price===85000)}"
        for nm, typ, opt in (('cobro','caja',"{variant:'cobro'}"), ('vuelto','caja',"{variant:'vuelto'}"), ('stock','stock','null'), ('adornos','adornos','null')):
            await pg.evaluate(f"GS.Minigames.open('{typ}', {cu}, {{onMistake(){{}},onEnd(){{}}}}, {opt})"); await pg.wait_for_timeout(600); await S(nm)
            print(nm, await pg.evaluate("(()=>{const m=document.getElementById('mg');return [m.scrollHeight,m.clientHeight,m.style.touchAction]})()"))
        await pg.click('#mg .opt'); await pg.wait_for_timeout(400); await pg.click('#mg .opt'); await pg.wait_for_timeout(400); await pg.click('#mg .opt'); await pg.wait_for_timeout(600); await S('adornos_fin')
        await pg.evaluate("GS.Minigames.close(); GS.Store.set('testCond','lluvia'); GS.Game.goHome()"); await pg.wait_for_timeout(400)
        await pg.click('#btnPlay'); await pg.wait_for_timeout(5000); await S('lluvia')
        print(errs or 'ok'); await b.close()
asyncio.run(main())
