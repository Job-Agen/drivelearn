-- Contenu de DÉMONSTRATION pour essayer l'application avant l'import des scans officiels (Plan 4).
-- Questions génériques rédigées pour les tests : à remplacer par le contenu validé avant toute mise en vente.
-- Usage : psql "$DATABASE_URL" -f packages/db/seed/demo.sql   (idempotent : remplace le programme TG/B de démo)

begin;

create function pg_temp.q(p_lesson uuid, p_pos int, p_prompt text, p_explanation text, p_choices text[], p_correct int[], p_image text default null)
returns void
language plpgsql
as $$
declare
  v_q uuid;
begin
  insert into questions (unit_id, lesson_id, position, prompt, explanation, image_path, source, status)
  select unit_id, p_lesson, p_pos, p_prompt, p_explanation, p_image, 'démo', 'brouillon' from lessons where id = p_lesson
  returning id into v_q;
  insert into choices (question_id, label, is_correct, position)
  select v_q, label, i = any(p_correct), i from unnest(p_choices) with ordinality as t(label, i);
  update questions set status = 'validee' where id = v_q;
end $$;

create function pg_temp.lesson(p_unit uuid, p_pos int, p_title text, p_intro text, p_tip text)
returns uuid
language sql
as $$
  insert into lessons (unit_id, position, title, intro_title, intro_text, mentor_tip)
  values (p_unit, p_pos, p_title, p_title, p_intro, p_tip)
  returning id;
$$;

delete from programs where country_code = 'TG' and license_type = 'B';
insert into programs (country_code, license_type, name, status, exam_question_count, exam_pass_mark, exam_seconds_per_question)
values ('TG', 'B', 'Togo', 'publie', 20, 13, 30),
       ('BJ', 'B', 'Bénin', 'brouillon', 20, 13, 30),
       ('CI', 'B', 'Côte d''Ivoire', 'brouillon', 20, 13, 30)
on conflict (country_code, license_type) do nothing;

do $$
declare
  v_program uuid := (select id from programs where country_code = 'TG' and license_type = 'B');
  v_unit uuid;
  v_lesson uuid;
begin
  -- Unité 1 : signalisation -----------------------------------------------------------------
  insert into units (program_id, title, position) values (v_program, 'Les panneaux', 1) returning id into v_unit;

  v_lesson := pg_temp.lesson(v_unit, 1, 'Les formes des panneaux',
    'La forme et la couleur donnent des indices.',
    'Observe avant de répondre.');
  update lessons set intro_title = 'Reconnaître les formes', intro_image_path = 'panneaux-formes.png' where id = v_lesson;
  perform pg_temp.q(v_lesson, 0, 'Quel est ce panneau ?',
    'Le mot STOP permet d''identifier ce panneau.', array['Stop', 'Stationnement', 'Sens interdit'], array[1], 'panneau-stop.png');
  perform pg_temp.q(v_lesson, 5, 'Quel symbole vois-tu ?',
    'Le P blanc sur fond bleu indique un parking.', array['La lettre P', 'Une flèche', 'Un piéton'], array[1], 'panneau-parking.png');
  perform pg_temp.q(v_lesson, 1, 'Un panneau triangulaire à bordure rouge indique :',
    'Le triangle à bordure rouge annonce un danger.', array['Un danger', 'Une interdiction', 'Une obligation', 'Une indication'], array[1]);
  perform pg_temp.q(v_lesson, 2, 'Un panneau rond à fond bleu indique :',
    'Rond et bleu : c''est une obligation.', array['Une interdiction', 'Une obligation', 'Un danger'], array[2]);
  perform pg_temp.q(v_lesson, 3, 'Un panneau rond à bordure rouge indique :',
    'Rond à bordure rouge : c''est une interdiction.', array['Une obligation', 'Une indication', 'Une interdiction'], array[3]);
  perform pg_temp.q(v_lesson, 4, 'Quels panneaux ont une forme particulière, reconnaissable même de dos ?',
    'Le « Stop » (octogone) et le « Cédez le passage » (triangle pointe en bas) ont des formes uniques.',
    array['Le panneau Stop', 'Le panneau Cédez le passage', 'Le panneau Sens interdit', 'Le panneau Parking'], array[1, 2]);

  v_lesson := pg_temp.lesson(v_unit, 2, 'Les feux tricolores',
    'Le feu rouge impose l''arrêt, le feu vert autorise le passage si la voie est libre, le feu orange fixe impose l''arrêt sauf si l''arrêt est dangereux.',
    'Un feu vert ne te dispense jamais de vérifier que le carrefour est dégagé.');
  perform pg_temp.q(v_lesson, 1, 'Le feu passe à l''orange alors que je peux m''arrêter sans danger. Je dois :',
    'L''orange fixe impose l''arrêt, sauf si s''arrêter serait dangereux.', array['Accélérer pour passer', 'M''arrêter', 'Klaxonner et passer'], array[2]);
  perform pg_temp.q(v_lesson, 2, 'Au feu vert, le carrefour est encombré. Je peux m''engager :',
    'On ne s''engage pas si l''on risque de bloquer le carrefour.', array['Oui', 'Non'], array[2]);
  perform pg_temp.q(v_lesson, 3, 'Un feu orange clignotant signifie :',
    'L''orange clignotant invite à la prudence ; les règles de priorité s''appliquent.', array['Arrêt obligatoire', 'Prudence, je passe en respectant les priorités', 'Le feu est en panne, je passe sans regarder'], array[2]);
  perform pg_temp.q(v_lesson, 4, 'Un agent règle la circulation à un carrefour équipé de feux. J''obéis :',
    'Les gestes de l''agent l''emportent sur les feux et les panneaux.', array['Aux feux', 'À l''agent', 'Aux panneaux'], array[2]);

  -- Unité 2 : priorités ------------------------------------------------------------------------
  insert into units (program_id, title, position) values (v_program, 'Les priorités', 2) returning id into v_unit;

  v_lesson := pg_temp.lesson(v_unit, 1, 'La priorité à droite',
    'À une intersection sans panneau ni feu, on cède le passage aux véhicules qui arrivent par la droite.',
    'Sans panneau, regarde d''abord à droite.');
  perform pg_temp.q(v_lesson, 1, 'À une intersection sans signalisation, je laisse passer :',
    'Sans signalisation, la priorité à droite s''applique.', array['Les véhicules venant de gauche', 'Les véhicules venant de droite', 'Le plus gros véhicule'], array[2]);
  perform pg_temp.q(v_lesson, 2, 'La priorité à droite s''applique aussi aux deux-roues venant de droite :',
    'La règle vaut pour tous les véhicules, motos et vélos compris.', array['Oui', 'Non'], array[1]);
  perform pg_temp.q(v_lesson, 3, 'Je sors d''un chemin de terre pour rejoindre une route. Je dois :',
    'En sortant d''un chemin de terre, d''un parking ou d''une propriété, on cède le passage à tous.', array['Céder le passage', 'Passer en premier', 'Appliquer la priorité à droite'], array[1]);
  perform pg_temp.q(v_lesson, 4, 'Quels usagers dois-je laisser passer en priorité, quelle que soit la situation ?',
    'Les véhicules d''intérêt général prioritaires (sirène et gyrophare) passent en premier.',
    array['Une ambulance avec sirène et gyrophare', 'Les pompiers en intervention', 'Un taxi pressé', 'Un camion de livraison'], array[1, 2]);

  v_lesson := pg_temp.lesson(v_unit, 2, 'Stop et cédez le passage',
    'Au « Stop », l''arrêt complet est obligatoire à la ligne, même si la voie est libre. Au « Cédez le passage », on ralentit et on s''arrête seulement si nécessaire.',
    'Stop veut dire arrêt complet : les roues ne tournent plus.');
  perform pg_temp.q(v_lesson, 1, 'Au panneau Stop, la voie est entièrement dégagée. Je dois :',
    'L''arrêt est obligatoire dans tous les cas.', array['Marquer un arrêt complet', 'Ralentir et passer', 'Passer sans ralentir'], array[1]);
  perform pg_temp.q(v_lesson, 2, 'Au panneau Cédez le passage, la voie est dégagée. Je peux passer sans m''arrêter :',
    'L''arrêt n''est obligatoire que si un véhicule arrive.', array['Oui', 'Non'], array[1]);
  perform pg_temp.q(v_lesson, 3, 'Au Stop, je m''arrête :',
    'On s''arrête à la limite de la chaussée abordée, matérialisée par la ligne continue.', array['À la ligne d''arrêt', 'Au milieu du carrefour', 'Là où je vois le mieux, même après la ligne'], array[1]);
  perform pg_temp.q(v_lesson, 4, 'Dans un rond-point signalé par « Cédez le passage » à l''entrée, la priorité appartient :',
    'Les véhicules déjà engagés dans l''anneau sont prioritaires.', array['Aux véhicules qui entrent', 'Aux véhicules déjà dans le rond-point'], array[2]);

  -- Unité 3 : sécurité ------------------------------------------------------------------------
  insert into units (program_id, title, position) values (v_program, 'Sécurité et comportement', 3) returning id into v_unit;

  v_lesson := pg_temp.lesson(v_unit, 1, 'Ceinture, téléphone et alcool',
    'La ceinture protège tous les occupants. Le téléphone tenu en main et l''alcool réduisent fortement l''attention et les réflexes.',
    'Avant de démarrer : ceinture bouclée, téléphone rangé.');
  perform pg_temp.q(v_lesson, 1, 'Qui doit attacher sa ceinture ?',
    'Tous les occupants, à l''avant comme à l''arrière.', array['Le conducteur', 'Le passager avant', 'Les passagers arrière', 'Personne en ville'], array[1, 2, 3]);
  perform pg_temp.q(v_lesson, 2, 'Je peux téléphoner en tenant mon téléphone à la main en conduisant :',
    'Le téléphone tenu en main est interdit au volant.', array['Oui, à faible vitesse', 'Non, jamais'], array[2]);
  perform pg_temp.q(v_lesson, 3, 'L''alcool au volant :',
    'L''alcool allonge le temps de réaction et donne une fausse impression de maîtrise.', array['Allonge le temps de réaction', 'Améliore les réflexes', 'Réduit le champ de vision', 'N''a aucun effet en petite quantité'], array[1, 3]);
  perform pg_temp.q(v_lesson, 4, 'Je suis fatigué au volant. La bonne attitude est de :',
    'Seul le repos combat la fatigue ; on s''arrête dans un endroit sûr.', array['Ouvrir la fenêtre et continuer', 'M''arrêter en sécurité et me reposer', 'Accélérer pour arriver plus vite'], array[2]);

  v_lesson := pg_temp.lesson(v_unit, 2, 'Distances et dépassements',
    'Plus la vitesse est élevée, plus la distance d''arrêt est longue. Un dépassement se prépare : visibilité, rétroviseurs, clignotant, puis on se rabat sans gêner.',
    'Garde au moins deux secondes entre toi et le véhicule devant.');
  perform pg_temp.q(v_lesson, 1, 'Sur route mouillée, la distance de freinage :',
    'L''adhérence diminue : il faut plus de distance pour s''arrêter.', array['Diminue', 'Reste la même', 'Augmente'], array[3]);
  perform pg_temp.q(v_lesson, 2, 'Avant de dépasser, je dois :',
    'On vérifie la visibilité et les rétroviseurs, puis on signale son intention.',
    array['Vérifier que la voie est libre assez loin', 'Regarder dans mes rétroviseurs', 'Mettre mon clignotant', 'Klaxonner longuement'], array[1, 2, 3]);
  perform pg_temp.q(v_lesson, 3, 'Je peux dépasser juste avant le sommet d''une côte :',
    'La visibilité y est insuffisante : le dépassement est dangereux et interdit.', array['Oui', 'Non'], array[2]);
  perform pg_temp.q(v_lesson, 4, 'Une ligne continue au milieu de la chaussée :',
    'La ligne continue ne doit être ni franchie ni chevauchée.', array['Peut être franchie pour dépasser', 'Ne doit pas être franchie', 'Peut être chevauchée'], array[2]);
end $$;

commit;
