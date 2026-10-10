"use client";

import React from "react";
import Link from "next/link";
import { Shell, useShell } from "./Shell";
import { TapeTitle } from "./ui";
import { LegacyArt } from "./art";

/** The way back to the V3 screens. They keep their own URLs and their own look; only this index is new. */
function LegacyBody() {
  const { c } = useShell();
  const l = c.legacyLinks;
  const links = [
    { href: "/legacy/home", copy: l.oldHome },
    { href: "/sessions", copy: l.sessions },
    { href: "/products", copy: l.products },
    { href: "/insights", copy: l.insights },
    { href: "/simulator", copy: l.simulator },
    { href: "/integrations", copy: l.integrations },
    { href: "/live/new", copy: l.create },
  ];
  return (
    <div className="legacy">
      <h1><TapeTitle text={c.legacyTitle} mark={c.legacyTitleMark} /></h1>
      <p className="lede">{c.legacyIntro}</p>
      <ul className="legacy-list" data-testid="legacy-links">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.copy[0]}</Link>
            <p>{link.copy[1]}</p>
          </li>
        ))}
      </ul>
      <LegacyArt />
    </div>
  );
}

export function LegacyScreen() {
  return (
    <Shell screen="legacy">
      <LegacyBody />
    </Shell>
  );
}
