# Etapa 4 (cierre): oficina, mejoras nuevas, interrupciones, cordura, final y tarjeta.  Uso: python3 test/v7.py
import asyncio, os, base64
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + ROOT + '/dist/index.html'
ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        for name, w, h, mob in (('d', 1000, 760, False), ('p', 390, 844, True)):
            ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=mob, is_mobile=mob)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
            pg.on('console', lambda m: errs.append('CONSOLE: ' + m.text) if m.type == 'error' else None)
            S = lambda f: pg.screenshot(path=f'{ROOT}/shots/7_{name}_{f}.png')
            await pg.goto(URL); await pg.wait_for_timeout(1200)
            await pg.evaluate("GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto',glasses:true}); GS.Store.set('coins',9000); GS.Store.set('days',4); GS.Store.set('seen',{mostrador:1,caja:1,whatsapp:1,cierre:1,repo:1,stock:1,vidriera:1,ml:1,proveedor:1,pc:1,service:1,devol:1}); GS.DEBUG_NOINTRO=1")
            await pg.reload(); await pg.wait_for_timeout(1200)
            await pg.evaluate("document.getElementById('start').hidden=true"); await pg.wait_for_timeout(200); await S('world0')
            await pg.evaluate("document.getElementById('start').hidden=false")
            # tienda: mejoras nuevas
            await pg.click('#btnShop'); await pg.wait_for_timeout(600)
            n = await pg.evaluate("GS.UPGRADES.length")
            for i in range(7, n):
                await pg.evaluate(f"document.querySelector('.slotb[data-i=\"{i}\"]').click()"); await pg.wait_for_timeout(1500); await S(f'shop{i}')
                await pg.evaluate("document.querySelector('[data-buy]').click()"); await pg.wait_for_timeout(300)
            await pg.click('#shopDone'); await pg.wait_for_timeout(1200)
            await pg.evaluate("document.getElementById('start').hidden=true"); await pg.wait_for_timeout(200); await S('world1')
            await pg.evaluate("document.getElementById('start').hidden=false")
            # jornada con interrupción
            await pg.evaluate("GS.DEBUG_INTR=1"); await pg.click('#btnPlay'); await pg.wait_for_timeout(2600); await S('dueno')
            await pg.wait_for_function("GS.Game.day().wave>=0", timeout=60000); await pg.evaluate("GS.Game.debugIntr()"); await pg.wait_for_timeout(500); await S('intr')
            await pg.click('[data-intr="1"]'); await pg.wait_for_timeout(500); await S('intr_ok')
            print(name, 'cordura', await pg.evaluate("Math.round(GS.Game.day().cord)"))
            await pg.evaluate("GS.Game.day().cord=20"); await pg.wait_for_timeout(400); await S('mate')
            await pg.evaluate("GS.Game.day().score=1500; GS.Game.endDay()"); await pg.wait_for_timeout(900); await pg.screenshot(path=f'{ROOT}/shots/7_{name}_end.png', full_page=True)
            await pg.click('#endCard'); await pg.wait_for_timeout(1200); await S('card')
            data = await pg.evaluate("document.getElementById('cardImg').src")
            open(f'{ROOT}/shots/7_{name}_tarjeta.png', 'wb').write(base64.b64decode(data.split(',')[1]))
            await pg.click('[data-close]'); await pg.click('#endHome'); await pg.wait_for_timeout(300)
            # final
            await pg.evaluate("GS.Game.startFinal()"); await pg.wait_for_timeout(4200); await S('final1')
            await pg.wait_for_timeout(12500); await S('final2')
            await pg.wait_for_function("!document.getElementById('finCard').hidden", timeout=240000); await pg.wait_for_timeout(700); await S('final3')
            await pg.click('#finShare'); await pg.wait_for_timeout(900); await pg.click('[data-close]'); await pg.click('#finGo'); await pg.wait_for_timeout(600); await S('home')
            await pg.click('#btnOpts'); await pg.wait_for_timeout(300); await S('opts'); await pg.click('[data-close]')
            print(name, await pg.evaluate("GS.Game.state()"), errs or 'ok'); await ctx.close()
        await b.close()
asyncio.run(main())
