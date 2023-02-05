import type { Database } from '@cloudflare/d1';
import { Router } from 'itty-router';

export interface Env {
    DB: Database;
    __router?: any;
}

interface Body {
    email: string
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        if (!env.__router) {
            const router = Router();
            router.post('/', async () => {
                const { email } = await request.json<Body>();
                if (!email) return new Response("email not provided", { status: 400 })

                const exist = await env.DB.prepare(`select id from subscription where email=?`)
                    .bind(email)
                    .all()

                if (exist) return new Response("Already Exist")

                const sender = request.headers.has("X-forwarded-for") ? request.headers.get("X-forwarded-for") : request.headers.get("Origin");
                const res = await env.DB.prepare(`
                                                 insert into subscription 
                                                 (email, site, created_at, sender, user_agent) 
                                                 values (?, ?, ?, ?, ?)
                                                 `)
                    .bind(
                        email,
                        request.headers.get("Origin"),
                        Date.now(),
                        sender,
                        request.headers.get("User-Agent"))
                    .run()

                if ("error" in res) {
                    return new Response("Error", { status: 404 });
                }

                return new Response("Success", { status: 200 });
            })

            router.all('*', () => new Response(null, { status: 404 }));
            env.__router = router;
        }

        return env.__router.handle(request);

    }
}
