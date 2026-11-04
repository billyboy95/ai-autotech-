-- Team seat and WhatsApp number catalogue lines.
-- Additive. Not applied. Pending Billy's yes. This is not an APPLY-ORDER step 20 through 36.
-- Do not paste this file into production from the draft pull request.
-- Prices are placeholders in ZAR cents and exclude VAT. They match src/lib/pricing/price-sheet.ts:
-- extra_team_seat 14900 (R149 a month), extra_whatsapp_number 9900 (R99 a month).
-- Not a client quote. No VAT line. AI AutoTech is not VAT-registered.
-- sending_enabled is not turned on. PayFast is not called. Sandbox only.

do $seed_seat_plans$
declare
  agency uuid;
begin
  select id into agency from public.organizations where slug = 'ai-autotech';
  if agency is null then
    raise notice 'ai-autotech org missing; seat plans were not seeded';
  else
    insert into public.plans (org_id, code, name, price_cents, currency, interval, limits, features)
    values
      (
        agency,
        'extra_team_seat',
        'Extra team seat (placeholder)',
        14900,
        'ZAR',
        'month',
        '{"unit":"seat"}'::jsonb,
        '{"addon":"team_seat","price_placeholder":true,"vat_excluded":true}'::jsonb
      ),
      (
        agency,
        'extra_whatsapp_number',
        'Extra WhatsApp number (placeholder)',
        9900,
        'ZAR',
        'month',
        '{"unit":"whatsapp_number"}'::jsonb,
        '{"addon":"whatsapp_number","price_placeholder":true,"vat_excluded":true}'::jsonb
      )
    on conflict (code) do update set
      name = excluded.name,
      price_cents = excluded.price_cents,
      currency = excluded.currency,
      interval = excluded.interval,
      limits = excluded.limits,
      features = excluded.features,
      updated_at = now();
  end if;

  if to_regclass('public.pricing_sheet') is not null then
    insert into public.pricing_sheet (key, amount_cents, quantity, percent, price_placeholder, note)
    values
      (
        'extra_team_seat',
        14900,
        1,
        null,
        true,
        'Placeholder. Extra team seat per month. Not a client quote. Excludes VAT.'
      ),
      (
        'extra_whatsapp_number',
        9900,
        1,
        null,
        true,
        'Placeholder. Extra connected WhatsApp number per month. Not a client quote. Excludes VAT.'
      )
    on conflict (key) do update set
      amount_cents = excluded.amount_cents,
      quantity = excluded.quantity,
      percent = excluded.percent,
      price_placeholder = true,
      note = excluded.note;
  end if;
end
$seed_seat_plans$;
