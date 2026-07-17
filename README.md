<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=200&color=gradient&customColorList=6,11,20&text=PDF%20Renamer%20v2&fontColor=fff&fontSize=38&fontAlignY=35&desc=Sistema%20interno%20para%20organiza%C3%A7%C3%A3o%20de%20prontu%C3%A1rios%20digitais&descAlignY=55&descSize=16"/>

<br>

<img src="https://skillicons.dev/icons?i=html,css,javascript,git,github,vscode" />

<br>

![Status](https://img.shields.io/badge/status-em%20uso-success?style=for-the-badge)
![Versão](https://img.shields.io/badge/version-2.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-6e40c9?style=for-the-badge)

> Sistema desenvolvido durante minha atuação como **Jovem Aprendiz** no  
> **Instituto Educacional Luterano**, com foco em automatizar a organização de documentos digitais dos alunos.

</div>

---

# 📌 Sobre o projeto

O **PDF Renamer v2** é uma aplicação web desenvolvida para otimizar o processo interno de organização dos prontuários digitais dos alunos.

Antes do sistema, cada documento precisava ser aberto, analisado, renomeado manualmente e salvo na pasta correta. Esse processo consumia bastante tempo durante matrículas e atualizações cadastrais.

A aplicação automatiza praticamente todo esse fluxo, permitindo visualizar PDFs, identificar automaticamente o tipo do documento e salvá-lo diretamente na pasta do aluno com o nome padronizado.

Além da produtividade, o objetivo foi reduzir erros humanos e padronizar a estrutura dos arquivos utilizados pelo setor administrativo.

---

# ✨ Funcionalidades

- 📄 Importação de múltiplos arquivos PDF
- 👀 Visualização do documento sem sair da aplicação
- 🤖 Classificação automática baseada no conteúdo do PDF
- 🏷️ Sugestão automática do nome do arquivo
- 📂 Salvamento direto na pasta do aluno
- 📑 Navegação entre páginas
- 🔎 Controle de zoom
- 🔄 Rotação do documento
- ⌨️ Atalhos de teclado para agilizar o trabalho
- 📊 Barra de progresso da fila
- 🔍 Pesquisa de arquivos carregados
- 📁 Persistência da pasta utilizada anteriormente
- ⚠️ Tratamento de arquivos duplicados
- 📈 Exportação do histórico de renomeações
- 💾 Armazenamento local de configurações

---

## Demonstração

```console
┌─ PDF Renamer v2 ──────────────────────────────── 12 arquivos ──┐
│                                                                │
│  ▣ Pasta de destino: 2026_JOAO_SILVA        [trocar]           │
│                                                                │
│  scan_0041.pdf                                                 │
│    ✦ FORMULARIO DE MATRICULA                                   │
│  scan_0042.pdf                                                 │
│    ✦ FICHA MEDICA ESCOLAR                                      │
│  scan_0043.pdf                                                 │
│    // digitalizado · manual                                    │
│                                                                │
│  Tipo: [FORMULARIO DE MATRICULA]  ✦ sugerido automaticamente   │
│  > FORMULARIO DE MATRICULA 2026 .pdf          [Salvar]         │
│                                                                │
│  ✓ Gravado em 2026_JOAO_SILVA/FORMULARIO DE MATRICULA 2026.pdf │
└────────────────────────────────────────────────────────────────┘
```

# 🚀 Tecnologias

<div align="center">

[![My Skills](https://skillicons.dev/icons?i=html,css,javascript,git,github,vscode)](https://skillicons.dev)

</div>

| Tecnologia | Utilização |
|------------|------------|
| HTML5 | Estrutura da aplicação |
| CSS3 | Interface moderna e responsiva |
| JavaScript (ES6+) | Lógica da aplicação |
| PDF.js | Renderização e leitura dos PDFs |
| File System Access API | Escrita direta nas pastas do Windows |
| IndexedDB | Persistência da pasta selecionada |
| LocalStorage | Configurações e preferências do usuário |

---

# 🖥️ Interface

## Principais recursos

- Sidebar para gerenciamento dos arquivos
- Visualizador integrado de PDF
- Sistema inteligente de classificação
- Barra de renomeação rápida
- Indicadores de progresso
- Painel de atalhos
- Interface otimizada para uso diário

---

# 🤖 Classificação Inteligente

Um dos principais diferenciais do projeto é o sistema de classificação automática.

A aplicação realiza a leitura textual dos PDFs utilizando o **PDF.js**, identifica palavras-chave presentes no documento e sugere automaticamente o tipo correspondente.

Exemplos:

- Formulário de Matrícula
- Contrato Educacional
- Declaração de Escolaridade
- Ficha Médica Escolar
- Capa Financeiro
- Documentos

Caso o documento seja digitalizado sem texto pesquisável, o sistema identifica essa situação e permite a classificação manual.

---

# ⚡ Recursos desenvolvidos

- Sistema de sugestões automáticas
- Persistência da pasta de destino
- Detecção de PDFs digitalizados
- Suporte a arrastar e soltar (Drag & Drop)
- Criação dinâmica de novos tipos de documentos
- Inclusão automática do ano no nome do arquivo
- Navegação totalmente por teclado
- Controle inteligente de arquivos duplicados
- Exportação de log em CSV
- Interface inspirada em softwares profissionais

---

## Estrutura do projeto

```
renamer/
├── index.html              # marcação e estrutura da interface
├── assets/
│   ├── css/
│   │   └── style.css       # tokens de tema, layout e componentes
│   ├── js/
│   │   └── app.js          # classificador, File System Access, viewer
│   └── img/
│       └── logo.png        # logo / favicon
└── README.md
```

## Como executar

```bash
# clonar o repositório
git clone https://github.com/kevinhsdev/pdf-renamer.git
cd pdf-renamer

# servir localmente (necessário: arquivo local via file:// bloqueia parte das APIs)
python3 -m http.server 8000

# abrir no navegador
# http://localhost:8000

# abra em um navegador compatível com a **File System Access API**, como o Google Chrome ou Microsoft Edge.
```

> **Navegador:** a gravação direta em pasta requer Chrome ou Edge. No Firefox a ferramenta funciona normalmente, mas cai no download tradicional.

## Melhorias futuras

- [ ] OCR para documentos digitalizados sem camada de texto
- [ ] Sugestão de pasta do aluno pelo nome lido no documento
- [ ] Modo lote: aplicar sugestões de todos os arquivos de uma vez
- [ ] Perfis de tipos por setor (secretaria / financeiro)
- [ ] Dicionário de palavras-chave editável pela interface

---

# 💡 Problema solucionado

Antes da ferramenta:

- Abrir PDF
- Ler documento
- Descobrir o tipo
- Digitar nome
- Escolher pasta
- Salvar

Após o desenvolvimento:

- Arrastar PDFs
- Confirmar sugestões
- Salvar

O tempo necessário para organizar dezenas de documentos foi reduzido significativamente, tornando o processo muito mais rápido e padronizado.

---

# 📚 Aprendizados

Durante o desenvolvimento foram aplicados diversos conceitos importantes, como:

- Manipulação avançada de arquivos
- APIs modernas do navegador
- Leitura e renderização de PDFs
- Organização de aplicações JavaScript
- Persistência local de dados
- UX voltada para produtividade
- Otimização de fluxos administrativos

---

# 👨‍💻 Autor

<div align="center">

<img src="https://avatars.githubusercontent.com/kevinhsdev" width="100"/>

### Kevin Henrique da Silva

Desenvolvedor Full Stack em formação

[![GitHub](https://img.shields.io/badge/GitHub-kevinhsdev-181717?style=for-the-badge&logo=github)](https://github.com/kevinhsdev)

</div>

---

<div align="center">

⭐ Este projeto foi desenvolvido para uso interno no **Instituto Educacional Luterano** com o objetivo de automatizar um processo administrativo real, reduzindo tempo operacional e aumentando a padronização dos documentos.

</div>
