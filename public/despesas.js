/* Farol — Despesas.
 *
 * Havia aqui um ecrã inteiro: uma tabela de despesas no topo das Finanças.
 * Deixou de fazer falta — as despesas passaram a ser um dos cinco widgets
 * que todas as áreas têm (area-tarefas.js), e ter a mesma lista duas vezes no
 * mesmo ecrã só confundia.
 *
 * O que ficou é o que a tabela fazia e o widget não sabia fazer: apagar uma
 * despesa que nasceu de uma leitura errada. É chamado pela linha da despesa
 * no widget.
 */
'use strict';

/* Apagar a despesa, não o ficheiro: se ela tinha vindo da caixa de entrada,
   o ficheiro fica lá, outra vez por triar. */
function dpApagar(x, depois) {
  var nome = x.description || 'esta despesa';
  if (!window.confirm('Apagar «' + nome + '»?\n\nSe tiver vindo da caixa de entrada, o ficheiro volta a ficar por triar.')) return;
  apiGestao('/api/despesas/' + x.id, { method: 'DELETE' }).then(function (r) {
    toast(r.caixa && r.caixa.length
      ? 'Despesa apagada. O ficheiro voltou à caixa, por triar.'
      : 'Despesa apagada.');
  }).catch(function (e) {
    toast(e.message || 'Não foi possível apagar a despesa.');
  /* Correndo bem ou mal, a lista volta a ser o que a base de dados diz. */
  }).then(function () {
    if (typeof depois === 'function') depois();
    if (typeof ibCarregar === 'function') ibCarregar();
  });
}
