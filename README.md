# Wefter

Suite de agentes e skills para conduzir um fluxo agentico de desenvolvimento de aplicacoes: discovery, pesquisa de concorrentes, refinamento de produto, refinamento tecnico, planejamento por modulos, geracao de tasks, implementacao orientada a testes com TDD e review adversarial.

O pacote foi desenhado para ser instalado em qualquer repositorio que use opencode, sem depender de git ativo e sem sobrescrever configuracao existente.

## O Que Vem Neste Pacote

- `.opencode/agents`: agentes especializados para cada etapa do fluxo.
- `.opencode/skills`: skills acionaveis pelo opencode com contratos, workflows e templates.
- `docs`: documentacao de metodologia, contratos e mapa de artefatos gerados.
- `scripts/wefter.mjs`: instala e remove a suite em qualquer plataforma com Node.js.
- `scripts/validate.mjs`: valida agents, skills, frontmatter, fences Markdown e arquivos instalaveis.
- `package.json`: expoe o binario `wefter` caso o pacote seja usado via npm/link.

## Instalacao

Com Node.js:

```bash
node scripts/wefter.mjs install --target "C:\caminho\do\repositorio"
```

Ou, em um caminho Unix-like:

```bash
node scripts/wefter.mjs install --target /caminho/do/repositorio
```

Se omitir o alvo, o script instala no diretorio atual.

Para sobrescrever arquivos da suite que ja existam no alvo:

```bash
node scripts/wefter.mjs install --target /caminho/do/repositorio --force
```

Para ver o que seria instalado sem escrever arquivos:

```bash
node scripts/wefter.mjs install --target /caminho/do/repositorio --dry-run
```

Depois de instalar, reinicie o opencode. Configuracoes, agents e skills sao carregados apenas na inicializacao.

## Remocao

Com Node.js:

```bash
node scripts/wefter.mjs uninstall --target "C:\caminho\do\repositorio"
```

Ou, em um caminho Unix-like:

```bash
node scripts/wefter.mjs uninstall --target /caminho/do/repositorio
```

A remocao apaga somente os agents, skills e manifesto instalados por esta suite. Os artefatos de produto gerados no repositorio, por padrao em `docs/wefter/`, nao sao removidos.

Se algum arquivo instalado foi modificado manualmente, o uninstall aborta por seguranca. Use `--force` apenas se quiser remover mesmo assim.

## Inspecao E Validacao

Listar arquivos instalaveis:

```bash
node scripts/wefter.mjs list
```

Checar uma instalacao em outro repositorio:

```bash
node scripts/wefter.mjs check --target /caminho/do/repositorio
```

Validar esta suite antes de instalar ou commitar alteracoes:

```bash
npm run validate
```

## Uso Basico

1. Instale a suite no repositorio onde quer trabalhar.
2. Reinicie o opencode.
3. Selecione o agente `wefter`.
4. No primeiro uso, responda ao setup: idioma dos artefatos, modo, raiz dos artefatos e politica de pesquisa de concorrentes.
5. Envie uma ideia simples, por exemplo: `Quero criar uma plataforma para academias gerenciarem treinos e pagamentos`.
6. O fluxo comeca em discovery e avancara etapa por etapa, sempre bloqueando o proximo modulo ate o modulo atual estar refinado, implementado e revisado.

## Setup Inicial

O agente nao infere automaticamente o idioma dos artefatos. Ele pergunta antes de criar `docs/wefter/00-index.md`.

Configuracao padrao recomendada:

```yaml
workflow_mode: standard
artifact_language: pt-BR
artifact_root: docs/wefter
complexity_default: medium
competitor_research_policy: offer-during-discovery
```

`workflow_mode: standard` e o padrao. A instalacao nao muda por modo; o agente orienta a profundidade por etapa.

## Complexidade Por Etapa

- Baixa: MVP rapido, menos documentacao, foco em proximo passo seguro.
- Media: recomendada, contratos e gates padrao.
- Alta: pesquisa mais profunda, maior rastreabilidade tecnica/produto e revisao mais rigorosa.
- Em todas as complexidades, implementacao segue TDD por padrao: escrever teste que falha, implementar o minimo para passar, refatorar e registrar evidencia.

O usuario pode pedir, por exemplo: `faca esse modulo com complexidade alta` ou `seguir discovery em baixa complexidade`.

## Principios Do Fluxo

- Comecar com input minimo: uma frase ou poucas ideias bastam.
- Rodar setup antes do primeiro artefato para definir idioma e raiz.
- Oferecer pesquisa web antes de estudar concorrentes.
- Consolidar features por grupos, core e vertentes possiveis.
- Selecionar posicionamento e features antes de dividir em modulos.
- Trabalhar um modulo por vez, ate implementacao e review final.
- Gerar tasks somente depois de refinamento completo de produto e tecnico.
- Planejar testes junto com cada task, incluindo o primeiro teste esperado e os comandos de verificacao.
- Exigir review humano antes de iniciar desenvolvimento agentico.
- Implementar tasks com ciclo TDD red/green/refactor sempre que houver harness de testes viavel.
- Registrar todas as decisoes tomadas durante desenvolvimento.
- Usar review adversarial em loop para cada task, incluindo checagem de evidencia TDD e lacunas de teste.
- Manter uma arvore de artefatos com dependencias e propagacao de mudancas.

## Artefatos Gerados No Projeto Alvo

Por padrao, agentes e skills criam e mantem documentos em:

```text
docs/wefter/
```

O arquivo mais importante de navegacao e saude documental e:

```text
docs/wefter/05-ops/artifact-map.md
```

Ele contem fluxogramas Mermaid com a arvore de arquivos, quem gera quem, quem depende de quem e quais documentos devem ser revisitados quando um artefato muda.

## Documentacao

- `docs/contracts.md`: contratos de entrada e saida por etapa.
- `docs/artifacts.md`: especificacao dos arquivos gerados no repositorio alvo.
- `docs/methodology.md`: metodologias combinadas e como elas orientam o fluxo.
- `docs/artifact-map-template.md`: template Mermaid para o mapa de artefatos.
