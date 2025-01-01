"use client";

import { Button } from "./ui/button";
import { GitIcon, VercelIcon, MenuIcon } from "./icons";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useSidebar } from "./sidebar-provider";

export const Navbar = () => {
  const { data: session } = useSession();
  const { toggle } = useSidebar();

  return (
    <div className="p-2 flex flex-row gap-2 justify-between items-center">
      <div className="flex gap-2 items-center">
        <Link href="https://github.com/vercel-labs/ai-sdk-preview-python-streaming">
          <Button variant="outline">
            <GitIcon /> View Source Code
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 items-center">
        {session?.user?.name && (
          <span className="text-sm text-gray-500">
            {session.user.name}
          </span>
        )}
        {session && (
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          >
            Sign Out
          </Button>
        )}
        <Link href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fai-sdk-preview-python-streaming">
          <Button>
            <VercelIcon />
            Deploy with Vercel
          </Button>
        </Link>
      </div>
    </div>
  );
};
