-- Farol — dados do ambiente de QUALIDADE. Tudo fictício.
BEGIN;

TRUNCATE settings, calendars, events, event_sources, attention, tasks, tiles,
  family_dates, support_routines, maintenance, consumption, issues, assets,
  projects, budget_categories, finance_summary, finance_alerts, subscriptions,
  credits, reserves, business_income, habit_log, habits, appointments, activity,
  documents, archive_sources, notes, people RESTART IDENTITY CASCADE;

INSERT INTO settings (key, value) VALUES
  ('today','2026-08-28'),
  ('today_label','Sexta-feira, 28 de agosto de 2026 · semana 35'),
  ('month_label','Agosto de 2026'),
  ('month','2026-08'),
  ('week_label','24 – 30 ago'),
  ('household','Casa Bastos'),
  ('env_nota','Os dados não são reais — nenhum cliente, valor ou compromisso aqui existe.'),
  ('owner','Marco');

INSERT INTO people (code, name, role, initials, color, note, sort) VALUES
  ('marco','Marco','Eu','MB','var(--c1)','Comité às 10:00',1),
  ('ana','Ana Lúcia','Companheira','AL','var(--c2)','Centro da Amadora, 11:00–20:00',2),
  ('ilda','Ilda','Mãe · apoio regular','IL','var(--c4)','Consulta de rotina, 17:30',3),
  ('joaquim','Joaquim','Pai · apoio regular','JQ','var(--c4)','Compras da semana, quinta',4),
  ('tomas','Tomás','Sobrinho','TM','var(--c5)','Anos a 14 de setembro',5);

INSERT INTO calendars (code, name, color, sort) VALUES
  ('marco','Marco','var(--c1)',1),
  ('ana','Ana Lúcia','var(--c2)',2),
  ('todos','Família','var(--c3)',3),
  ('pais','Pais','var(--c4)',4),
  ('tomas','Tomás','var(--c5)',5);

INSERT INTO events (day, at, title, calendar, detail) VALUES
  ('2026-08-03','10:00','Comité DIS','marco',NULL),
  ('2026-08-04','19:00','Aula do MBA','marco',NULL),
  ('2026-08-05',NULL,'Contas da casa dos pais','pais','Débito directo'),
  ('2026-08-06','17:00','Compras dos pais','pais',NULL),
  ('2026-08-08','09:00','Sábado no centro','ana','Kids & Nits'),
  ('2026-08-09','13:00','Almoço de família','todos',NULL),
  ('2026-08-11','19:00','Aula do MBA','marco',NULL),
  ('2026-08-13','17:00','Compras dos pais','pais',NULL),
  ('2026-08-15',NULL,'Férias em família','todos',NULL),
  ('2026-08-16',NULL,'Férias em família','todos',NULL),
  ('2026-08-17',NULL,'Férias em família','todos',NULL),
  ('2026-08-18',NULL,'Férias em família','todos',NULL),
  ('2026-08-19',NULL,'Férias em família','todos',NULL),
  ('2026-08-20',NULL,'Férias em família','todos',NULL),
  ('2026-08-21',NULL,'Férias em família','todos',NULL),
  ('2026-08-22','11:00','Regresso — arrumar casa','todos',NULL),
  ('2026-08-24','10:00','Comité DIS','marco',NULL),
  ('2026-08-24','17:00','Compras da semana','todos',NULL),
  ('2026-08-25','19:00','Aula do MBA','marco',NULL),
  ('2026-08-26','20:00','Jantar em casa dos pais','todos',NULL),
  ('2026-08-27','11:00','Estores — orçamento','marco',NULL),
  ('2026-08-27','17:00','Compras dos pais','pais',NULL),
  ('2026-08-28','08:15','Revisão do carro','marco','Oficina, Amadora'),
  ('2026-08-28','10:00','Comité de arquitetura','marco','Trabalho · 2 h · sala 4'),
  ('2026-08-28','13:00','Almoço com a Ana Lúcia','todos',NULL),
  ('2026-08-28','17:30','Boleia à mãe — consulta de rotina','pais','Confirmado ontem'),
  ('2026-08-28','19:00','Fecho do dia — Kids & Nits','ana','11 atendimentos marcados'),
  ('2026-08-29','10:00','Compras da semana','todos',NULL),
  ('2026-08-30','15:00','Caso do MBA','marco',NULL),
  ('2026-08-31','09:00','Entrega do caso — AESE','marco',NULL),
  ('2026-09-01',NULL,'Seguro do carro termina','marco',NULL),
  ('2026-09-02','19:00','Aula do MBA','marco',NULL),
  ('2026-09-03','11:00','Escolher orçamento dos estores','marco',NULL),
  ('2026-09-03','17:00','Compras dos pais','pais',NULL),
  ('2026-09-05',NULL,'Fim do prazo das simulações — Fulas Rides','marco',NULL),
  ('2026-09-06','13:00','Almoço de família','todos',NULL),
  ('2026-09-08','11:00','Centro — reforço de horário','ana',NULL),
  ('2026-09-12','09:30','Dentista','marco',NULL),
  ('2026-09-12',NULL,'Railway sai do trial','marco',NULL),
  ('2026-09-14',NULL,'Anos do Tomás','tomas',NULL),
  ('2026-09-15',NULL,'Módulo de follow-up — marco do projeto','marco',NULL);

INSERT INTO event_sources (name, detail, status_label, status_level, sort) VALUES
  ('Calendário partilhado da família','Escrita nos dois sentidos','Ligado','good',1),
  ('Calendário do trabalho','Só ocupado/livre — sem títulos','Leitura','accent',2),
  ('Agenda do centro (gicnet)','Turnos da Ana Lúcia e fecho do dia','1×/dia','',3),
  ('Prazos dos Documentos e Projetos','Entram como marcos, não como reuniões','Automático','',4);

INSERT INTO attention (level, title, detail, when_label, when_level, sort) VALUES
  ('crit','Seguro do carro termina a 1 de setembro','Renovação automática desligada. Duas propostas alternativas por comparar.','4 dias','bad',1),
  ('due','Fulas Rides — decidir a viatura','Simulações CA Auto Bank válidas até 5 set. Model 3 LR e Model Y LR ainda empatadas na comparação.','8 dias','warn',2),
  ('due','Kids & Nits — 6 revisões de maio por marcar','Campanha de regresso às aulas ainda por enviar. Contacto por WhatsApp, manual.','Esta semana','warn',3),
  ('info','MBA AESE — caso a entregar segunda','Leitura feita, análise por escrever. Estimativa: 3 h.','31 ago','accent',4);

INSERT INTO tasks (scope, title, tag, tag_level, done, sort) VALUES
  ('hoje','Confirmar consulta da mãe','Apoio','',TRUE,1),
  ('hoje','Pagar água','Casa','',TRUE,2),
  ('hoje','Pedir 2.ª proposta de seguro','Hoje','bad',FALSE,3),
  ('hoje','Escrever análise do caso do MBA','MBA','',FALSE,4),
  ('hoje','Confirmar boleia das 17:30','Apoio','',FALSE,5),
  ('familia','Marcar almoço de família — setembro','Ana Lúcia','',FALSE,1),
  ('familia','Prenda do Tomás (14 set)','Marco','',FALSE,2),
  ('familia','Renovar cartão de refeição','Marco','',FALSE,3),
  ('familia','Confirmar boleia de sexta','Marco','',TRUE,4),
  ('projetos','Escrever a análise do caso (3 h)','31 ago','warn',FALSE,1),
  ('projetos','Fechar comparação Model 3 vs Model Y','5 set','bad',FALSE,2),
  ('projetos','Enviar campanha de regresso às aulas (WhatsApp)','K&N','',FALSE,3),
  ('projetos','Especificar leitura das fichas assinadas (Drive)','K&N','',FALSE,4),
  ('projetos','Publicar página Hoje da app de gestão','Feito','good',TRUE,5);

INSERT INTO tiles (label, value, note, goto, sort) VALUES
  ('Orçamento de agosto','68%','gasto ao dia 28 — dentro do plano','financas',1),
  ('Casa','2','avarias abertas · 1 revisão hoje','casa',2),
  ('Projetos ativos','4','1 em risco (Fulas Rides)','projetos',3),
  ('Agenda de hoje','5','compromissos · 3 pessoas envolvidas','agenda',4);

INSERT INTO family_dates (title, when_label, sort) VALUES
  ('Anos do Tomás','14 set',1),
  ('Aniversário de casamento dos pais','2 out',2),
  ('Anos da Ana Lúcia','19 nov',3);

INSERT INTO support_routines (title, detail, status_label, status_level, sort) VALUES
  ('Compras da semana','Quintas, alternado com a irmã','Feito 27 ago','good',1),
  ('Boleia a consultas de rotina','Marcações no calendário partilhado','Hoje 17:30','warn',2),
  ('Contas da casa dos pais','Débito directo · confirmar dia 5','Dia 5','',3),
  ('Visita de fim-de-semana','Domingo à tarde','Domingo','accent',4);

INSERT INTO maintenance (item, periodicity, last_label, next_label, status_label, status_level, sort) VALUES
  ('Revisão do carro','Anual','ago 2025','hoje','Em curso','accent',1),
  ('Caldeira — revisão','Anual','out 2025','out 2026','Agendar','',2),
  ('Filtros do ar condicionado','Semestral','fev 2026','atrasado','2 meses','warn',3),
  ('Extintor — validade','Bienal','mar 2025','mar 2027','Válido','good',4),
  ('Limpeza de calhas e varanda','Semestral','mar 2026','set 2026','A chegar','',5);

INSERT INTO consumption (utility, unit, month_label, value, is_current, delta_label, delta_level, sort) VALUES
  ('Eletricidade','kWh','mar',412,FALSE,NULL,NULL,1),
  ('Eletricidade','kWh','abr',358,FALSE,NULL,NULL,2),
  ('Eletricidade','kWh','mai',300,FALSE,NULL,NULL,3),
  ('Eletricidade','kWh','jun',268,FALSE,NULL,NULL,4),
  ('Eletricidade','kWh','jul',322,FALSE,NULL,NULL,5),
  ('Eletricidade','kWh','ago',248,TRUE,'−12% ago','good',6),
  ('Água','m³','mar',9.1,FALSE,NULL,NULL,1),
  ('Água','m³','abr',9.6,FALSE,NULL,NULL,2),
  ('Água','m³','mai',8.7,FALSE,NULL,NULL,3),
  ('Água','m³','jun',10.2,FALSE,NULL,NULL,4),
  ('Água','m³','jul',10.8,FALSE,NULL,NULL,5),
  ('Água','m³','ago',11.4,TRUE,'+8% ago','warn',6),
  ('Gás','m³','mar',46,FALSE,NULL,NULL,1),
  ('Gás','m³','abr',38,FALSE,NULL,NULL,2),
  ('Gás','m³','mai',26,FALSE,NULL,NULL,3),
  ('Gás','m³','jun',18,FALSE,NULL,NULL,4),
  ('Gás','m³','jul',14,FALSE,NULL,NULL,5),
  ('Gás','m³','ago',12,TRUE,'−6% ago','good',6);

INSERT INTO issues (title, detail, status_label, status_level, sort) VALUES
  ('Estore do quarto encravado','Orçamento pedido a 27 ago · 2 fornecedores','À espera','warn',1),
  ('Torneira da cozinha a pingar','Peça comprada · falta montar','Fim-de-semana','',2);

INSERT INTO assets (name, bought_label, warranty_label, warranty_level, sort) VALUES
  ('Máquina de lavar','mar 2024','até mar 2027','good',1),
  ('Caldeira','set 2019','expirada','',2),
  ('MacBook Air','jan 2025','até jan 2028','good',3),
  ('Frigorífico','jun 2022','termina jun 2027','warn',4);

INSERT INTO projects (name, description, status_label, status_level, progress, milestone, hours_4w, sort) VALUES
  ('Kids & Nits Amadora','Operação do centro e app de gestão própria. Loja aberta desde maio.','A andar','good',62,'Módulo de follow-up na app — 15 set',18,1),
  ('Fulas Rides','Frota TVDE. Decisão de viatura parada há 11 dias; propostas com prazo.','Em risco','bad',35,'Escolher viatura e assinar leasing — 5 set',3,2),
  ('Executive MBA — AESE','MBA XXV. Business case a usar dados reais da Kids & Nits.','Prazo curto','warn',78,'Entrega do caso — segunda, 31 ago',14,3),
  ('Casa — estores e garagem','Duas frentes pequenas, para fechar até ao fim do ano.','Sem pressa','',20,'Escolher orçamento dos estores — 3 set',5,4);

INSERT INTO budget_categories (month_label, name, spent, budget, sort) VALUES
  ('Agosto de 2026','Casa (crédito, condomínio, energia)',980,980,1),
  ('Agosto de 2026','Alimentação',610,700,2),
  ('Agosto de 2026','Transportes e combustível',240,300,3),
  ('Agosto de 2026','Formação (MBA)',450,450,4),
  ('Agosto de 2026','Apoio aos pais',150,200,5),
  ('Agosto de 2026','Lazer e restaurantes',210,180,6),
  ('Agosto de 2026','Poupança',400,400,7);

INSERT INTO finance_summary (label, value, note, sort) VALUES
  ('Gasto','3 040 €','de 3 210 € planeados',1),
  ('Fixas por sair','92 €','2 débitos até dia 31',2);

INSERT INTO finance_alerts (level, badge, title, detail, sort) VALUES
  ('bad','Excesso','Lazer 30 € acima do plano','3.º mês seguido',1),
  ('warn','Novo','Débito de 39,90 € não categorizado','22 ago · provável ginásio',2),
  ('good','Bom','Alimentação abaixo do plano','−90 € face à média',3);

INSERT INTO subscriptions (name, amount_label, cycle, next_charge, note, note_level, yearly, cuttable, sort) VALUES
  ('Streaming de vídeo','13,99 €','Mensal','3 set','Em uso','',167.88,FALSE,1),
  ('Música — plano família','17,99 €','Mensal','7 set','Em uso','',215.88,FALSE,2),
  ('Armazenamento na nuvem','2,99 €','Mensal','11 set','Em uso','',35.88,FALSE,3),
  ('Railway — alojamento da app','≈ 18 €','Mensal','12 set','Sai do trial','warn',216.00,FALSE,4),
  ('Ginásio','39,90 €','Mensal','22 set','3 idas em 60 dias','bad',478.80,TRUE,5),
  ('Antivírus / segurança','59,00 €','Anual','14 out','Rever','warn',59.00,TRUE,6);

INSERT INTO credits (name, detail, amount_label, badge, badge_level, sort) VALUES
  ('Crédito habitação','Euribor 6 M + spread · termina 2041','612 €/mês',NULL,NULL,1),
  ('Crédito automóvel','Termina out 2027','130 €/mês',NULL,NULL,2),
  ('Leasing da frota (proposta)','84 meses · reforço inicial de 5 000 € · por assinar',NULL,'Simulação','warn',3);

INSERT INTO reserves (name, detail, status_label, status_level, pct, sort) VALUES
  ('Fundo de emergência','Meta: 6 meses de despesa fixa','4,2 meses','warn',70,1),
  ('PPR','Reforço anual em dezembro','Em dia','good',NULL,2),
  ('Conta da operação TVDE','Separada das contas pessoais','Negócio','accent',NULL,3);

INSERT INTO business_income (name, detail, status_label, status_level, sort) VALUES
  ('Kids & Nits — agosto','Acima do ponto crítico desde julho','+ margem','good',1),
  ('Fulas Rides','Sem frota activa','A arrancar','',2);

INSERT INTO habits (name, sort) VALUES
  ('Treino / ginásio',1), ('Caminhada 30 min',2), ('Leitura do MBA',3), ('Deitar antes da meia-noite',4);

INSERT INTO habit_log (habit_id, dow, level) VALUES
  (1,0,2),(1,1,0),(1,2,2),(1,3,0),(1,4,1),(1,5,0),(1,6,0),
  (2,0,2),(2,1,2),(2,2,2),(2,3,2),(2,4,2),(2,5,0),(2,6,0),
  (3,0,2),(3,1,2),(3,2,0),(3,3,2),(3,4,1),(3,5,0),(3,6,0),
  (4,0,2),(4,1,0),(4,2,2),(4,3,0),(4,4,0),(4,5,0),(4,6,0);

INSERT INTO appointments (title, who, when_label, when_level, sort) VALUES
  ('Dentista — higiene oral','Marco','12 set','',1),
  ('Consulta de rotina','Ilda · boleia combinada','hoje 17:30','',2),
  ('Check-up anual','Marco · por marcar','Marcar','warn',3),
  ('Oftalmologia — renovar óculos','Ana Lúcia','nov','',4);

INSERT INTO activity (week_index, minutes) VALUES
  (1,150),(2,210),(3,225),(4,260),(5,235),(6,180),(7,130),(8,145);

INSERT INTO documents (name, entity, valid_until, status_label, status_level, sort) VALUES
  ('Seguro automóvel','Seguradora','1 set 2026','4 dias','bad',1),
  ('Railway — fim do trial','Railway','12 set 2026','15 dias','warn',2),
  ('Inspeção do carro','Centro de inspeções','nov 2026','2 meses','',3),
  ('Seguro de saúde','Seguradora','1 nov 2026','2 meses','',4),
  ('Contrato de arrendamento — centro','Senhorio','jan 2027','5 meses','',5),
  ('IUC','AT','mar 2027','Em dia','good',6),
  ('Cartão de cidadão','IRN','2029','Válido','good',7);

INSERT INTO archive_sources (name, detail, status_label, status_level, sort) VALUES
  ('Fichas de cliente assinadas','Drive · leitura 3×/dia · 214 ficheiros','Sincronizado','good',1),
  ('Faturas da casa','Por ano e fornecedor','Manual','',2),
  ('Apólices e contratos','12 documentos','Manual','',3),
  ('Documentos do MBA','Casos, notas e trabalhos','Manual','',4);

INSERT INTO notes (slug, body) VALUES
  ('projetos_tempo','O projecto em risco é o que menos tempo recebeu. É o padrão que este painel existe para mostrar.'),
  ('docs_avisos','Cada documento tem uma data e uma antecedência própria. O seguro avisa a 30, 15 e 5 dias; a inspeção avisa a 60. O que passa para o painel Hoje é só o que já entrou na janela de aviso — o resto fica aqui, quieto.'),
  ('agenda_nota','Clica num dia para o abrir ao lado. As bolinhas dizem de quem é o compromisso.'),
  ('agenda_carga','Sábado é o único dia da semana sem nada marcado. Vale a pena mantê-lo assim.'),
  ('subs_nota','Duas candidatas a corte valem 598 €/ano.'),
  ('saude_nota','Média semanal a descer desde o início do caso do MBA. Volta a subir quando a entrega passar.');

COMMIT;
