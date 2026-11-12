import sys, asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        errs=[]
        async def run(name,w,h,mobile=True):
            ctx = await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2, has_touch=mobile, is_mobile=mobile)
            pg = await ctx.new_page()
            pg.on('console', lambda m: errs.append(name+' '+m.type+': '+m.text) if m.type in('error','warning') else None)
            pg.on('pageerror', lambda e: errs.append(name+' PAGEERROR: '+str(e)))
            await pg.goto('file:///home/claude/gss/dist/index.html')
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f'shots/{name}_1start.png')
            await pg.evaluate("localStorage.setItem('gameshop_simulator_v1', JSON.stringify({best:[],tutorial:true,mute:false,quality:'auto'}))")
            await pg.click('#btnPlay')
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=f'shots/{name}_1b.png')
            await pg.click('[data-close]')
            await pg.wait_for_function("GS.Game.day().customers.some(c=>c.st==='waitM')", timeout=20000)
            await pg.wait_for_timeout(8000)
            await pg.screenshot(path=f'shots/{name}_2day.png')
            await pg.click('#stM'); await pg.wait_for_timeout(1200)
            await pg.screenshot(path=f'shots/{name}_3most.png')
            # elegir el correcto
            await pg.evaluate("(()=>{const d=GS.Game.day();const c=d.customers.find(c=>c.st==='inM');document.querySelector('.opt[data-id=\"'+c.product.id+'\"]').click()})()")
            await pg.wait_for_function("GS.Game.day().customers.some(c=>c.st==='waitC')", timeout=20000)
            await pg.screenshot(path=f'shots/{name}_3b.png')
            await pg.click('#stC'); await pg.wait_for_timeout(1200)
            await pg.screenshot(path=f'shots/{name}_4caja.png')
            await ctx.close()
        which = sys.argv[1] if len(sys.argv)>1 else 'all'
        if which in ('all','p'): await run('p',390,844)
        if which in ('all','l'): await run('l',844,390)
        if which in ('all','d'): await run('d',1280,800,False)
        print('\n'.join(errs) or 'sin errores')
        await b.close()
asyncio.run(main())
