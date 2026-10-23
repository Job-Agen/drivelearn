-- Premiers cours officiels (4 pages du cours de code, envoyées le 14/10/2026) pour le programme Togo / permis voiture.
-- Les questions sont rédigées à partir du texte du cours et importées « À vérifier » : chacune doit être relue
-- puis validée dans le site d'administration avant d'être servie aux élèves.
-- Usage : psql "$DATABASE_URL" -f packages/db/seed/cours-tg-01.sql
-- Sans effet si le programme a déjà une unité « Le code et le permis » (pas de doublon en cas de relance).

begin;

create function pg_temp.lesson(p_unit uuid, p_pos int, p_title text, p_intro text, p_tip text)
returns uuid
language sql
as $$
  insert into lessons (unit_id, position, title, intro_title, intro_text, mentor_tip)
  values (p_unit, p_pos, p_title, p_title, p_intro, p_tip)
  returning id;
$$;

create function pg_temp.q(p_lesson uuid, p_pos int, p_page text, p_prompt text, p_explanation text, p_choices text[], p_correct int[])
returns void
language plpgsql
as $$
declare
  v_q uuid;
begin
  insert into questions (unit_id, lesson_id, position, prompt, explanation, source, source_page, status)
  select unit_id, p_lesson, p_pos, p_prompt, p_explanation, 'Cours de code (scan)', p_page, 'a_verifier'
  from lessons where id = p_lesson
  returning id into v_q;
  insert into choices (question_id, label, is_correct, position)
  select v_q, label, i = any(p_correct), i from unnest(p_choices) with ordinality as t(label, i);
end $$;

do $$
declare
  v_program uuid := (select id from programs where country_code = 'TG' and license_type = 'voiture');
  v_unit uuid;
  v_lesson uuid;
begin
  if v_program is null then
    raise exception 'Programme TG / voiture introuvable';
  end if;
  if exists (select 1 from units where program_id = v_program and title = 'Le code et le permis') then
    raise notice 'Cours déjà importés : rien à faire';
    return;
  end if;

  -- Unité 1 : le code et le permis ------------------------------------------------------------
  insert into units (program_id, title, position) values (v_program, 'Le code et le permis', 1) returning id into v_unit;

  v_lesson := pg_temp.lesson(v_unit, 1, 'Le code de la route',
    'Le code de la route est l''ensemble des règles et des signalisations qui régissent la bonne circulation des usagers de la route.',
    'Connaître les règles, c''est d''abord se protéger et protéger les autres.');
  perform pg_temp.q(v_lesson, 1, 'p. 1', 'Le code de la route, c''est :',
    'Le code de la route est l''ensemble des règles et des signalisations qui régissent la bonne circulation des usagers de la route.',
    array['L''ensemble des règles et des signalisations de la circulation', 'La liste des routes d''un pays', 'Le règlement des auto-écoles'], array[1]);
  perform pg_temp.q(v_lesson, 2, 'p. 1', 'Pourquoi un usager doit-il connaître et respecter les signalisations routières ?',
    'Les signalisations routières doivent être connues, observées et respectées pour mieux se comporter sur la route et éviter les accidents.',
    array['Pour mieux se comporter sur la route et éviter les accidents', 'Uniquement pour réussir l''examen', 'Seulement pour éviter les amendes'], array[1]);

  v_lesson := pg_temp.lesson(v_unit, 2, 'Le permis de conduire',
    'Le permis de conduire est une attestation délivrée à une personne saine, pour une catégorie de véhicules : A1, A, B, C, D, E ou F.',
    'Chaque lettre correspond à un type de véhicule : retiens-les une par une.');
  perform pg_temp.q(v_lesson, 1, 'p. 1', 'Le permis de conduire est :',
    'C''est une attestation délivrée à une personne saine pouvant conduire une certaine catégorie de véhicules.',
    array['Une attestation délivrée à une personne saine pour une catégorie de véhicules', 'Une carte valable pour tous les véhicules', 'Une simple carte d''identité de conducteur'], array[1]);
  perform pg_temp.q(v_lesson, 2, 'p. 1', 'Quelle catégorie de permis concerne les véhicules automobiles de moins de 10 places (3 500 kg) ?',
    'La catégorie B concerne les véhicules automobiles de moins de 10 places (3 500 kg).',
    array['A', 'B', 'C', 'D'], array[2]);
  perform pg_temp.q(v_lesson, 3, 'p. 1', 'La catégorie C concerne :',
    'La catégorie C concerne les véhicules automobiles à marchandises (3 500 kg).',
    array['Les véhicules à marchandises', 'Les motocyclettes', 'Le transport en commun de personnes', 'Les véhicules aménagés pour les infirmes'], array[1]);
  perform pg_temp.q(v_lesson, 4, 'p. 1', 'Quelle catégorie concerne le transport en commun de personnes (plus de 9 places) ?',
    'La catégorie D concerne les véhicules automobiles de transport en commun de personnes (plus de 9 places).',
    array['B', 'C', 'D', 'E'], array[3]);
  perform pg_temp.q(v_lesson, 5, 'p. 1', 'La catégorie A1 concerne :',
    'La catégorie A1 concerne les cyclomoteurs et vélomoteurs (cylindrée de 50 cm³ à 125 cm³).',
    array['Les cyclomoteurs et vélomoteurs', 'Les camions', 'Les véhicules avec remorque'], array[1]);
  perform pg_temp.q(v_lesson, 6, 'p. 1', 'La catégorie E concerne :',
    'La catégorie E concerne les véhicules de catégorie B, C ou D attelés d''une remorque dont le poids total autorisé en charge dépasse 750 kg.',
    array['Les véhicules B, C ou D attelés d''une remorque de plus de 750 kg', 'Les motocyclettes avec side-car', 'Les véhicules aménagés pour les infirmes'], array[1]);
  perform pg_temp.q(v_lesson, 7, 'p. 1', 'La catégorie F concerne :',
    'La catégorie F concerne les véhicules de la catégorie B aménagés pour les infirmes.',
    array['Les véhicules de catégorie B aménagés pour les infirmes', 'Les véhicules de transport de marchandises', 'Les cyclomoteurs'], array[1]);

  -- Unité 2 : la signalisation routière --------------------------------------------------------
  insert into units (program_id, title, position) values (v_program, 'La signalisation routière', 2) returning id into v_unit;

  v_lesson := pg_temp.lesson(v_unit, 1, 'Les panneaux de danger',
    'La signalisation verticale, ce sont les panneaux implantés tout au long de la route. Les panneaux de danger sont triangulaires, à bordure rouge, avec le symbole du danger à l''intérieur.',
    'Triangle à bordure rouge = danger. Fond jaune : temporaire. Fond blanc : permanent.');
  perform pg_temp.q(v_lesson, 1, 'p. 1', 'Qu''appelle-t-on la signalisation verticale ?',
    'La signalisation verticale est l''ensemble des panneaux implantés tout au long de la route.',
    array['L''ensemble des panneaux implantés le long de la route', 'Les marques peintes sur la chaussée', 'Les feux tricolores'], array[1]);
  perform pg_temp.q(v_lesson, 2, 'p. 1', 'Quelle est la forme d''un panneau de danger ?',
    'Les panneaux de danger ont une forme triangulaire, une bordure rouge et le symbole du danger à l''intérieur.',
    array['Triangulaire à bordure rouge', 'Circulaire à fond bleu', 'Rectangulaire', 'Octogonale'], array[1]);
  perform pg_temp.q(v_lesson, 3, 'p. 1', 'En agglomération, à quelle distance du danger le panneau de danger est-il implanté ?',
    'Les panneaux de danger sont implantés à 50 m du danger en agglomération et à 150 m hors agglomération ou en rase campagne.',
    array['50 m', '150 m', '300 m', 'Juste devant le danger'], array[1]);
  perform pg_temp.q(v_lesson, 4, 'p. 1', 'Hors agglomération, à quelle distance du danger le panneau de danger est-il implanté ?',
    'Les panneaux de danger sont implantés à 150 m du danger hors agglomération ou en rase campagne (50 m en agglomération).',
    array['50 m', '100 m', '150 m'], array[3]);
  perform pg_temp.q(v_lesson, 5, 'p. 1', 'Un panneau de danger à fond jaune signale :',
    'Les panneaux de danger à fond jaune signalent des dangers temporaires ; ceux à fond blanc, des dangers permanents.',
    array['Un danger temporaire', 'Un danger permanent', 'Une obligation'], array[1]);
  perform pg_temp.q(v_lesson, 6, 'p. 1', 'Un panneau de danger à fond blanc signale :',
    'Les panneaux de danger à fond blanc signalent des dangers permanents ; ceux à fond jaune, des dangers temporaires.',
    array['Un danger temporaire', 'Un danger permanent', 'La fin d''un danger'], array[2]);

  v_lesson := pg_temp.lesson(v_unit, 2, 'Interdiction et obligation',
    'Les panneaux de prescription absolue sont les panneaux d''interdiction et d''obligation. Ils sont de forme circulaire.',
    'Rond à bordure rouge : interdit. Rond à fond bleu : obligatoire.');
  perform pg_temp.q(v_lesson, 1, 'p. 1', 'Les panneaux de prescription absolue regroupent :',
    'Ce sont les panneaux d''interdiction et d''obligation.',
    array['Les panneaux d''interdiction et d''obligation', 'Les panneaux de danger', 'Les panneaux d''indication'], array[1]);
  perform pg_temp.q(v_lesson, 2, 'p. 2', 'Comment reconnaît-on un panneau d''interdiction ?',
    'Les panneaux d''interdiction ont une forme circulaire avec une bordure rouge ; d''autres sont barrés d''un trait rouge oblique.',
    array['Forme circulaire, bordure rouge', 'Forme triangulaire, bordure rouge', 'Forme carrée, fond bleu'], array[1]);
  perform pg_temp.q(v_lesson, 3, 'p. 2', 'Un panneau d''interdiction à fond bleu impose une interdiction aux véhicules :',
    'Les panneaux d''interdiction à fond bleu imposent une interdiction aux véhicules qui ne sont pas en mouvement, par exemple l''arrêt et le stationnement interdits.',
    array['Qui ne sont pas en mouvement', 'En mouvement', 'De plus de 3 500 kg uniquement'], array[1]);
  perform pg_temp.q(v_lesson, 4, 'p. 2', 'Le panneau de limitation de vitesse est un panneau d''interdiction à fond :',
    'Les panneaux d''interdiction à fond blanc imposent une interdiction aux véhicules en mouvement, comme la limitation de vitesse.',
    array['Blanc', 'Bleu', 'Jaune'], array[1]);
  perform pg_temp.q(v_lesson, 5, 'p. 2', 'Comment est signalée la fin d''une interdiction ?',
    'La fin d''une interdiction est un panneau circulaire à bordure noire, fond blanc, barré d''un trait noir oblique.',
    array['Panneau circulaire à bordure noire, fond blanc, barré d''un trait noir', 'Panneau triangulaire à fond jaune', 'Panneau carré à fond bleu'], array[1]);
  perform pg_temp.q(v_lesson, 6, 'p. 2', 'Comment reconnaît-on un panneau d''obligation ?',
    'Les panneaux d''obligation ont une forme circulaire et un fond bleu. Leur fin est barrée d''un trait rouge oblique.',
    array['Forme circulaire, fond bleu', 'Forme circulaire, bordure rouge', 'Forme triangulaire, fond blanc'], array[1]);

  v_lesson := pg_temp.lesson(v_unit, 3, 'Indication et intersections',
    'Les panneaux d''indication sont rectangulaires, carrés ou en flèche. D''autres panneaux indiquent les intersections et les règles de priorité à y appliquer.',
    'Rectangle ou flèche : on t''informe. STOP et Cédez le passage : on règle la priorité.');
  perform pg_temp.q(v_lesson, 1, 'p. 2', 'Quelle est la forme des panneaux d''indication ?',
    'Les panneaux d''indication ont une forme rectangulaire ou carrée ; d''autres sont en flèche.',
    array['Rectangulaire ou carrée (ou en flèche)', 'Triangulaire', 'Circulaire'], array[1]);
  perform pg_temp.q(v_lesson, 2, 'p. 2', 'Que signalent les panneaux d''indication ?',
    'Ils indiquent l''entrée et la sortie d''une localité, des itinéraires et des endroits aménagés.',
    array['L''entrée et la sortie d''une localité, des itinéraires, des endroits aménagés', 'Un danger', 'Une interdiction'], array[1]);
  perform pg_temp.q(v_lesson, 3, 'p. 2', 'Le panneau STOP et le panneau Cédez le passage font partie des panneaux :',
    'Ce sont des panneaux relatifs aux intersections et aux régimes prioritaires : ils indiquent les intersections et les règles de priorité à y appliquer.',
    array['Relatifs aux intersections et aux régimes prioritaires', 'De danger', 'D''indication'], array[1]);

  v_lesson := pg_temp.lesson(v_unit, 4, 'Marquages au sol et feux',
    'La signalisation horizontale, ce sont les marques peintes sur la chaussée. La signalisation lumineuse, ce sont les feux tricolores.',
    'Vert : passe avec prudence. Orange : prépare-toi à t''arrêter. Rouge : arrêt obligatoire.');
  perform pg_temp.q(v_lesson, 1, 'p. 2', 'Qu''est-ce que la signalisation horizontale ?',
    'C''est l''ensemble des marques peintes sur la chaussée, ou marquages au sol.',
    array['Les marques peintes sur la chaussée', 'Les panneaux le long de la route', 'Les feux tricolores'], array[1]);
  perform pg_temp.q(v_lesson, 2, 'p. 2', 'À quoi servent les marquages au sol ?',
    'Ils signalent les différentes parties de la route, les voies affectées aux divers sens de circulation ou à certains usagers, et la conduite à tenir.',
    array['Ils signalent les parties de la route, les voies et la conduite à tenir', 'Ils décorent la chaussée', 'Ils indiquent seulement les passages piétons'], array[1]);
  perform pg_temp.q(v_lesson, 3, 'p. 2', 'Au feu orange, je dois :',
    'Feu orange : prépare-toi à t''arrêter.',
    array['Me préparer à m''arrêter', 'Accélérer pour passer', 'Passer avec prudence'], array[1]);
  perform pg_temp.q(v_lesson, 4, 'p. 2', 'Au feu rouge :',
    'Feu rouge : arrêt obligatoire.',
    array['L''arrêt est obligatoire', 'Je passe avec prudence', 'Je ralentis seulement'], array[1]);
  perform pg_temp.q(v_lesson, 5, 'p. 2', 'Au feu vert :',
    'Feu vert : passe avec prudence.',
    array['Je passe avec prudence', 'Je m''arrête', 'Je klaxonne avant de passer'], array[1]);

  v_lesson := pg_temp.lesson(v_unit, 5, 'Agents, signaux sonores et balises',
    'Les signaux des agents de circulation s''imposent à tous. Les véhicules prioritaires s''annoncent par leurs klaxons. Les balises signalent un danger le long de la route.',
    'Agent de profil : tu passes. Agent de face ou de dos : tu t''arrêtes.');
  perform pg_temp.q(v_lesson, 1, 'p. 3', 'L''agent de circulation est vu de profil. Je dois :',
    'Agent vu de profil : passage. Agent vu de face ou de dos : arrêt obligatoire.',
    array['Passer', 'M''arrêter', 'Faire demi-tour'], array[1]);
  perform pg_temp.q(v_lesson, 2, 'p. 3', 'L''agent de circulation est vu de face ou de dos. Je dois :',
    'Agent vu de face ou de dos : arrêt obligatoire.',
    array['Passer', 'M''arrêter', 'Klaxonner'], array[2]);
  perform pg_temp.q(v_lesson, 3, 'p. 3', 'Parmi ces véhicules, lesquels sont prioritaires ?',
    'Les véhicules prioritaires sont : ambulance, sapeurs-pompiers, police et gendarmerie en mission, services d''entretien se rendant sur un lieu d''intervention, SAMU et SMUR.',
    array['Une ambulance', 'Les sapeurs-pompiers', 'La police en mission', 'Un taxi'], array[1, 2, 3]);
  perform pg_temp.q(v_lesson, 4, 'p. 3', 'À quoi servent les balises ?',
    'Ce sont des dispositifs implantés le long des routes pour signaler un danger quelconque ou particulier.',
    array['À signaler un danger le long des routes', 'À indiquer une ville', 'À limiter la vitesse'], array[1]);
  perform pg_temp.q(v_lesson, 5, 'p. 3', 'La manche à air indique :',
    'La manche à air montre la force et la direction du vent.',
    array['La force et la direction du vent', 'La distance d''un passage à niveau', 'Le côté par lequel contourner un îlot'], array[1]);
  perform pg_temp.q(v_lesson, 6, 'p. 3', 'Quelle balise montre la distance à laquelle se situe le passage à niveau ?',
    'La balise d''alignement montre la distance à laquelle se situe le passage à niveau.',
    array['La balise d''alignement', 'La balise de virage', 'La balise d''intersection'], array[1]);
  perform pg_temp.q(v_lesson, 7, 'p. 3', 'La balise de tête d''îlot directionnelle indique :',
    'Elle montre de quel côté contourner l''îlot ou passer.',
    array['De quel côté contourner l''îlot', 'La force du vent', 'Un virage'], array[1]);

  -- Unité 3 : la route et les intersections ----------------------------------------------------
  insert into units (program_id, title, position) values (v_program, 'La route et les intersections', 3) returning id into v_unit;

  v_lesson := pg_temp.lesson(v_unit, 1, 'Les parties de la route',
    'La route est un passage aménagé et ouvert à la circulation publique. Elle comporte la chaussée, les voies, l''axe médian, le terre-plein central, les accotements, les trottoirs et les pistes cyclables.',
    'La chaussée est pour les véhicules, le trottoir pour les piétons.');
  perform pg_temp.q(v_lesson, 1, 'p. 3', 'La chaussée est :',
    'La chaussée est la partie goudronnée ou non goudronnée réservée à la circulation des véhicules.',
    array['La partie réservée à la circulation des véhicules', 'La partie réservée aux piétons', 'Le milieu de la route'], array[1]);
  perform pg_temp.q(v_lesson, 2, 'p. 4', 'Une voie est :',
    'La voie est une subdivision de la chaussée ayant une largeur suffisante pour la circulation d''une file de véhicules.',
    array['Une subdivision de la chaussée permettant la circulation d''une file de véhicules', 'L''ensemble de la route', 'Le bord de la chaussée'], array[1]);
  perform pg_temp.q(v_lesson, 3, 'p. 4', 'L''axe médian est :',
    'C''est le milieu de la chaussée, ligne imaginaire ou matérialisée (continue ou discontinue), qui sépare la chaussée en deux parties égales.',
    array['Le milieu de la chaussée qui la sépare en deux parties égales', 'Le bord droit de la chaussée', 'Une piste réservée aux cycles'], array[1]);
  perform pg_temp.q(v_lesson, 4, 'p. 4', 'Les trottoirs sont réservés :',
    'Les trottoirs sont les accotements aménagés, réservés à la circulation des piétons et à l''implantation des panneaux.',
    array['À la circulation des piétons et à l''implantation des panneaux', 'Au stationnement des véhicules', 'Aux cyclomoteurs'], array[1]);
  perform pg_temp.q(v_lesson, 5, 'p. 4', 'Quelle est la différence entre la piste cyclable et la bande cyclable ?',
    'La piste cyclable fait partie de l''accotement ; la bande cyclable fait partie de la chaussée, délimitée par une ligne continue ou discontinue. Les deux sont réservées aux cycles et cyclomoteurs.',
    array['La piste est sur l''accotement, la bande est sur la chaussée', 'La piste est sur la chaussée, la bande sur le trottoir', 'Il n''y a aucune différence'], array[1]);
  perform pg_temp.q(v_lesson, 6, 'p. 4', 'Le terre-plein central :',
    'C''est une élévation de terre, parfois aménagée en pavé, qui sépare la chaussée en deux et permet aux piétons de traverser en deux temps.',
    array['Sépare la chaussée et permet aux piétons de traverser en deux temps', 'Est réservé au stationnement', 'Est une voie de dépassement'], array[1]);

  v_lesson := pg_temp.lesson(v_unit, 2, 'Les intersections',
    'Une intersection est le lieu de croisement ou de jonction de deux ou plusieurs routes : en croix (X), en T, en Y ou à branches multiples.',
    'Sans signalisation, c''est la priorité à droite qui s''applique.');
  perform pg_temp.q(v_lesson, 1, 'p. 4', 'Une intersection est :',
    'C''est le lieu de croisement ou de jonction de deux ou plusieurs routes.',
    array['Le lieu de croisement ou de jonction de deux ou plusieurs routes', 'Une route à sens unique', 'Une voie réservée aux bus'], array[1]);
  perform pg_temp.q(v_lesson, 2, 'p. 4', 'Lesquels sont des types d''intersection ?',
    'Les différents types d''intersection : en croix (X), en T, en Y et à branches multiples.',
    array['En croix (X)', 'En T', 'En Y', 'En O'], array[1, 2, 3]);
  perform pg_temp.q(v_lesson, 3, 'p. 4', 'Dans un carrefour aménagé à l''indonésienne sans signalisation, quelle règle s''applique ?',
    'Le croisement se fait par la gauche, mais sans signalisation, c''est la priorité à droite qui s''applique.',
    array['La priorité à droite', 'La priorité à gauche', 'Le plus gros véhicule passe d''abord'], array[1]);
  perform pg_temp.q(v_lesson, 4, 'p. 4', 'Dans un carrefour aménagé à l''indonésienne, à quoi servent les voies du milieu ?',
    'Les voies du milieu sont dédiées pour tourner à gauche.',
    array['À tourner à gauche', 'À faire demi-tour', 'Au stationnement'], array[1]);
  perform pg_temp.q(v_lesson, 5, 'p. 4', 'À une intersection à branches multiples, le véhicule qui est sur la ligne STOP :',
    'La règle s''applique entre les véhicules circulant sur les voies principales, et la voiture qui est sur la ligne STOP passe en dernier.',
    array['Passe en dernier', 'Passe en premier', 'A la priorité à droite'], array[1]);
end $$;

commit;
