// @ts-nocheck
'use client';
import React from 'react';

/**
 * Renders table cells (th/td) in the order configured in the Page Layout
 * Designer. Every cell carries data-col="<field key>"; `order` maps field key
 * to display_order. Cells without an entry keep their original relative
 * position after the ordered ones (stable sort).
 */
export default function OrderedRow({ order = {}, children, ...rest }) {
  const kids = React.Children.toArray(children).filter(Boolean);
  const keyed = kids.map((el, i) => {
    const col = el && el.props ? el.props['data-col'] : undefined;
    const o = col !== undefined && order[col] !== undefined ? order[col] : 10000 + i;
    return { el, o, i };
  });
  keyed.sort((a, b) => a.o - b.o || a.i - b.i);
  return <tr {...rest}>{keyed.map(k => k.el)}</tr>;
}
