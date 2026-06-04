-- Run if 005_categories.sql was applied before seed_default_categories existed.

create or replace function public.seed_default_categories()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_parent_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.categories where user_id = v_user_id and type = 'income'
  ) then
    insert into public.categories (user_id, name, type, parent_id, icon, sort_order)
    values (v_user_id, 'Salary', 'income', null, 'pi-briefcase', 0)
    returning id into v_parent_id;

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order) values
      (v_user_id, 'S', 'income', v_parent_id, 'pi-wallet', 0),
      (v_user_id, 'K', 'income', v_parent_id, 'pi-wallet', 1);

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order)
    values (v_user_id, 'Rent', 'income', null, 'pi-home', 1)
    returning id into v_parent_id;

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order) values
      (v_user_id, 'R1', 'income', v_parent_id, 'pi-building-columns', 0),
      (v_user_id, 'R2', 'income', v_parent_id, 'pi-building-columns', 1);

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order) values
      (v_user_id, 'Gift', 'income', null, 'pi-gift', 2),
      (v_user_id, 'Sale', 'income', null, 'pi-money-bill', 3),
      (v_user_id, 'Other', 'income', null, 'pi-tag', 4);
  end if;

  if not exists (
    select 1 from public.categories where user_id = v_user_id and type = 'outcome'
  ) then
    insert into public.categories (user_id, name, type, parent_id, icon, sort_order) values
      (v_user_id, 'Food', 'outcome', null, 'pi-shopping-cart', 0),
      (v_user_id, 'Entertainment', 'outcome', null, 'pi-play', 1);

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order)
    values (v_user_id, 'Life needs', 'outcome', null, 'pi-home', 2)
    returning id into v_parent_id;

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order) values
      (v_user_id, 'Beauty', 'outcome', v_parent_id, 'pi-sparkles', 0),
      (v_user_id, 'Clothes', 'outcome', v_parent_id, 'pi-shopping-bag', 1),
      (v_user_id, 'Health', 'outcome', v_parent_id, 'pi-heart', 2),
      (v_user_id, 'Home', 'outcome', v_parent_id, 'pi-home', 3);

    insert into public.categories (user_id, name, type, parent_id, icon, sort_order) values
      (v_user_id, 'Traveling', 'outcome', null, 'pi-globe', 3),
      (v_user_id, 'Transport', 'outcome', null, 'pi-car', 4),
      (v_user_id, 'Donations', 'outcome', null, 'pi-gift', 5),
      (v_user_id, 'Other', 'outcome', null, 'pi-tag', 6),
      (v_user_id, 'Out of report', 'outcome', null, 'pi-eye-slash', 7);
  end if;
end;
$$;

revoke all on function public.seed_default_categories() from public;
grant execute on function public.seed_default_categories() to authenticated;
