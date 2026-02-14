"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

export function Header() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header
      className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-4xl transition-all duration-300 ${isScrolled ? "bg-background/80 backdrop-blur-md rounded-full" : "bg-transparent"}`}
      style={{
        boxShadow: isScrolled
          ? "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px"
          : "none",
      }}
    >
      <div className="flex items-center justify-between transition-all duration-300 px-4 pl-7 py-4">
        {/* Logo */}
        <Link
          href="/"
          className="text-2xl font-semibold tracking-tight transition-colors duration-300 text-foreground lowercase"
        >
          thread
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-10 md:flex">
          <Link
            href="/search"
            className="text-base transition-colors text-muted-foreground hover:text-foreground"
          >
            Search
          </Link>
          <Link
            href="#products"
            className="text-base transition-colors text-muted-foreground hover:text-foreground"
          >
            Collections
          </Link>
          <Link
            href="/outfit"
            className="text-base transition-colors text-muted-foreground hover:text-foreground"
          >
            Try On
          </Link>
          <Link
            href="/agent"
            className="text-base transition-colors text-muted-foreground hover:text-foreground"
          >
            Agent
          </Link>
        </nav>

        {/* CTA + Auth */}
        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/search"
            className="p-2.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Search"
          >
            <Search size={20} />
          </Link>
          {user ? (
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          ) : (
            <Link
              href="/login"
              className="px-6 py-2.5 text-base font-medium transition-all rounded-full bg-foreground text-background hover:opacity-80"
            >
              Get Started
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="transition-colors md:hidden text-foreground"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="border-t border-border bg-background px-6 py-8 md:hidden rounded-b-2xl">
          <nav className="flex flex-col gap-6">
            <Link
              href="/search"
              className="text-xl text-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              Search
            </Link>
            <Link
              href="#products"
              className="text-xl text-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              Collections
            </Link>
            <Link
              href="/outfit"
              className="text-xl text-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              Try On
            </Link>
            <Link
              href="/agent"
              className="text-xl text-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              Agent
            </Link>
            {user ? (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setIsMenuOpen(false);
                  handleSignOut();
                }}
              >
                Sign out
              </Button>
            ) : (
              <Link
                href="/login"
                className="mt-4 bg-foreground px-5 py-3.5 text-center text-base font-medium text-background rounded-full"
                onClick={() => setIsMenuOpen(false)}
              >
                Get Started
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
