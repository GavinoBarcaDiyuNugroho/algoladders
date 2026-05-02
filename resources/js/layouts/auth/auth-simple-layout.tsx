import { Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
            <div className="w-full max-w-md bg-card/80 backdrop-blur-md border border-border p-8 rounded-3xl shadow-xl relative z-10">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <Link
                            href={home()}
                            className="flex flex-col items-center gap-2 font-medium group"
                        >
                            <div className="mb-1 flex items-center justify-center rounded-md">
                                <h1 className="text-4xl font-black italic tracking-tighter group-hover:scale-105 transition-transform">
                                    ALGO<span className="text-primary">LADDERS</span>
                                </h1>
                            </div>
                            <span className="sr-only">{title}</span>
                        </Link>

                        <div className="space-y-2 text-center">
                            <h1 className="text-2xl font-bold">{title}</h1>
                            <p className="text-center text-sm text-muted-foreground font-medium">
                                {description}
                            </p>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
