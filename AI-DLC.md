# aidlc-ide-customizations

This project contains optimized customization files for AI-DLC (AI Development Life Cycle) integration with Amazon Q and Kiro. Features a sophisticated branching workflow with **load-on-demand architecture** that reduces system prompt size by 85% while maintaining comprehensive coverage of both monolith and microservices development paths.

## Table of Contents

1. [Workflow Architecture](#workflow-architecture)
2. [Core Workflow (Phases 1-4)](#core-workflow-phases-1-4)
3. [Monolith Path (Phases 5-8)](#monolith-path-phases-5-8)
4. [Microservices Path (Phases 5-8)](#microservices-path-phases-5-8)
5. [Project Structure](#project-structure)
6. [Usage](#usage)
7. [Performance Benefits](#performance-benefits)

## Workflow Architecture

The AI-DLC workflow follows a branching architecture with universal requirements handling:

```
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │ Intent Statement│    │   Requirements  │    │   Mixed Input   │
    │   (New Project) │    │    Document     │    │  (Any Format)   │
    └─────────────────┘    │ (Existing Reqs) │    └─────────────────┘
            │              └─────────────────┘           │
            │                      │                     │
            └──────────────────────┼─────────────────────┘
                                   ▼
                         ┌───────────────────┐
                         │    Requirements   │
                         │     Assessment    │
                         │ (AI Intelligence) │
                         └───────────────────┘
                                   │
                                   ▼
                         ┌─────────────────┐
                         │    User Story   │
                         │     Planning    │
                         └─────────────────┘
                                   │
                                   ▼
                         ┌─────────────────┐
                         │    User Story   │
                         │    Development  │
                         └─────────────────┘
                                   │
                                   ▼
                         ┌─────────────────┐
                         │   Architecture  │
                         │    Decision     │
                         └─────────────────┘
                                   │
                ┌──── Monolith ────┼─── Microservices ──┐
                │                  │                    │
                ▼                  │                    ▼
        ┌─────────────────┐        │           ┌─────────────────┐
        │     Design      │        │           │ Split Into      │
        │                 │        │           │ Units of Work   │
        │  Domain Model   │        │           └─────────────────┘
        │       +         │        │                   │
        │   Components    │        │                   ▼
        └─────────────────┘        │          ┌─────────────────┐
                │                  │          │   For Each Unit │
                ▼                  │          │                 │
        ┌─────────────────┐        │          │ ┌─────────────┐ │
        │      Code       │        │          │ │   Design    │ │
        └─────────────────┘        │          │ └─────────────┘ │
                │                  │          │        ↓        │
                ▼                  │          │ ┌─────────────┐ │
        ┌─────────────────┐        │          │ │    Code     │ │
        │     Deploy      │        |          │ └─────────────┘ │
        └─────────────────┘        │          │        ↓        │
                                   │          │ ┌─────────────┐ │
                                   │          │ │   Deploy    │ │
                                   │          │ └─────────────┘ │
                                   │          └─────────────────┘
```

## Core Workflow (Phases 1-4)

#### Phase 1: Requirements Assessment
- **Universal Phase**: Works with any input - intent statements, existing documents, or mixed content
- **Intelligent Analysis**: Uses AI intelligence to evaluate requirements completeness
- **Structured Verification**: Creates requirement-verification-questions.md with [Answer]: tags for systematic clarification
- **Document Support**: Automatically detects and converts various document formats to markdown
- **Mandatory Answer Analysis**: Reviews all user responses for ambiguity and requires clarification

#### Phase 2: Story Planning
- **Comprehensive Planning**: Creates detailed story development plan with embedded questions
- **Multiple Approaches**: Supports user journey-based, feature-based, persona-based story breakdown
- **Answer Analysis**: Mandatory review of all planning responses with follow-up questions for ambiguous answers
- **Audit Trail**: All planning decisions recorded with [Answer]: tags for transparency

#### Phase 3: Story Development
- **Story Creation**: Converts requirements into user story format using approved methodology
- **Persona Development**: Creates user archetypes and characteristics
- **Progress Tracking**: Real-time checkbox updates as work progresses through plan steps

#### Phase 4: Architecture Decision
- **Trade-off Analysis**: Detailed comparison between monolith and microservices approaches
- **Decision Criteria**: Questions about team size, scalability, deployment preferences, complexity tolerance
- **Dynamic Roadmap**: Updates workflow phases based on architectural choice

## Monolith Path (Phases 5-8)
- **Phase 5: Design Planning** - Comprehensive design methodology planning with embedded questions
- **Phase 6: Design Generation** - Holistic system design with component dependency matrix
- **Phase 7: Code Generation Planning** - Dependency-ordered code generation phases
- **Phase 8: Iterative Code Generation** - Foundation → Business Logic → API → Integration

## Microservices Path (Phases 5-8)
- **Phase 5: Unit of Work Planning** - Decomposition planning into independently developable units
- **Phase 6: Units of Work Generation** - Creates unit definitions, dependencies, and story mapping
- **Phase 7: Per-Unit Design Phase** - Individual unit design planning and generation (repeats per unit)
- **Phase 8: Per-Unit Code Generation** - Unit-specific code planning and implementation (repeats per unit)



## Usage

### Amazon Q Optimized Experience
- **Efficient Processing**: Compact system prompts (152 lines) enable faster AI responses
- **Contextual Loading**: Detailed steps loaded only when executing specific phases
- **Custom AI-DLC Branding**: Professional welcome message and process introduction
- **Enhanced Performance**: Reduced token usage improves conversation length and quality

### Key Features

#### Enhanced Requirements Handling
- **Universal Input Support**: Handles intent statements, existing documents, and mixed content seamlessly
- **Document Auto-Detection**: Searches workspace for existing requirements files
- **Format Conversion**: Automatically converts Word docs, PDFs, and text files to markdown
- **Intelligent Assessment**: Uses AI intelligence to evaluate requirements completeness and clarity
- **Structured Verification**: Creates requirement-verification-questions.md with [Answer]: tags for systematic clarification
- **Gap Analysis**: Identifies specific missing areas in functional and non-functional requirements

#### Mandatory Answer Analysis Framework
- **Ambiguity Detection**: Automatically identifies vague responses ("mix of", "not sure", "depends on")
- **Forced Clarification**: Requires specific follow-up questions for ambiguous answers
- **Decision Criteria**: Ensures clear decision rules for all planning choices
- **No Assumptions**: Prevents proceeding with unclear or contradictory responses

#### Advanced Progress Tracking
- **Two-Level Tracking**: Plan-level execution tracking + phase-level progress tracking
- **Mandatory Updates**: Checkbox updates required in same interaction as work completion
- **Dynamic State Management**: aidlc-state.md updates based on architectural choice
- **Session Continuity**: Automatic detection and resumption of existing projects with context
- **Real-time Status**: Always shows current phase, next steps, and completion status

### Target Users
The files in this repository are designed to be consumed by:
- **Amazon Q**: Optimized AI-DLC workflow with load-on-demand architecture
- **Kiro**: Identical enhanced workflow steering with requirements verification and session continuity
- **Development Teams**: Parallel unit development in microservices architecture with clear decision criteria
- **Project Managers**: Advanced progress tracking, audit trail management, and session resumption
- **Business Analysts**: Requirements verification and gap analysis for existing documentation
- **Other IDE Tools**: Enhanced AI-DLC integration specifications and workflow standards

### Getting Started

#### For New Projects
1. Start with intent statement - the workflow will guide you through requirements planning
2. Answer embedded questions using [Answer]: tags in planning documents
3. Receive mandatory clarification for any ambiguous responses
4. Proceed through story development to architecture decision

#### For Existing Requirements
1. Place requirements document in workspace (supports .md, .docx, .pdf, .txt)
2. Workflow automatically detects and offers conversion options
3. AI intelligence evaluates requirements completeness
4. Proceed through story planning with validated requirements

#### Session Resumption
- Workflow automatically detects existing aidlc-state.md files
- Presents current status and next steps
- Allows continuation from any phase or review of previous phases

## Project Structure

### Configuration Files Structure
```
.kiro/
└── steering/
    └── aws-aidlc 
        ├── custom-workflow-core.md
        ├── custom-workflow-monolith.md
        ├── custom-workflow-microservices.md
        └── custom-spec-format.md
```

### Generated Project Structure
When using these workflows, projects will automatically generate:

```
aidlc-docs/
├── plans/                                  # All planning documents with embedded questions
│   ├── story-generation-plan.md            # Story development planning
│   ├── design-generation-plan.md           # Design planning (monolith)
│   ├── code-generation-plan.md             # Code generation planning (monolith)
│   ├── unit-of-work-plan.md                # Unit decomposition (microservices)
│   ├── {unit-name}-design-plan.md          # Unit design planning (microservices)
│   └── {unit-name}-code-generation-plan.md # Unit code planning (microservices)
|
├── requirements/                           # Detailed requirements documents and verification questions
│   ├── requirements.md                     # Converted/generated requirements
│   └── requirement-verification-questions.md # Structured clarification questions with [Answer]: tags
|
├── design-artifacts/                       # Architecture decisions and design documents
│   ├── architectural-decisions.md          # Monolith vs microservices choice
│   ├── design.md                           # Main design document (monolith)
│   ├── domain-model.md                     # Domain model (monolith)
│   ├── api-specification.yaml              # API specification (monolith)
│   ├── component-diagram.md                # Component diagrams (monolith)
│   ├── component-dependency-matrix.md      # Dependencies (monolith)
│   ├── unit-of-work.md                     # Unit definitions (microservices)
│   ├── unit-of-work-dependency.md          # Unit dependencies (microservices)
│   ├── unit-of-work-story-map.md           # Story mapping (microservices)
│   └── {unit-name}                         # Unit-specific design artifacts (microservices)
│       ├── domain-model.md                 # Domain model of unit
│       ├── api-specification.md            # API specification of unit
│       ├── components.md                   # Components within a unit
│       └── component-dependency.md         # Component dependencies within a unit
|
├── story-artifacts/                        # User stories, personas, and units of work
│   ├── stories.md                          # Individual user stories
│   └── personas.md                         # User personas and archetypes
|
├── research/                               # Research and investigation notes
├── aidlc-state.md                          # Dynamic state tracking with architecture-specific phases
└── audit.md                                # Approval prompts and responses with timestamps
```

## Amazon Q Implementation

### Load-on-Demand Architecture
Amazon Q uses an efficient **load-on-demand architecture** that significantly reduces system prompt size while maintaining comprehensive workflow coverage:

- **Compact Rules Files**: Main workflow files contain only orchestration logic (152 lines vs 1000+ lines previously)
- **On-Demand Loading**: Detailed steps (1,200+ lines) loaded only when needed for specific phases
- **Consistent Pattern**: Every phase follows the same 3-step pattern: Load → Execute → Confirm
- **Critical Logic Preserved**: Mandatory answer analysis remains in main files for enforcement

### Amazon Q Advantages
- **Optimized Performance**: Reduced system prompt size (152 lines vs 1000+ lines) improves response speed and context efficiency
- **On-Demand Precision**: Detailed steps (1,200+ lines) loaded only when needed, reducing cognitive overhead
- **Enhanced AI-DLC Workflow**: Complete branching workflow with existing requirements support and mandatory answer analysis
- **Workflow Override**: Overrides built-in IDE workflows to provide enhanced development lifecycle management
- **Custom Welcome Experience**: AI-DLC branded introduction with clear process explanation

### Amazon Q Optimized Experience
- **Efficient Processing**: Compact system prompts (152 lines) enable faster AI responses
- **Contextual Loading**: Detailed steps loaded only when executing specific phases
- **Custom AI-DLC Branding**: Professional welcome message and process introduction
- **Enhanced Performance**: Reduced token usage improves conversation length and quality

## Kiro Implementation

### Kiro Steering Files
- **.kiro/steering/custom-workflow-core.md** - Core AI-DLC workflow phases (Requirements → Stories → Architecture Decision)
- **.kiro/steering/custom-workflow-monolith.md** - Monolith-specific workflow continuation (Design → Code Generation)
- **.kiro/steering/custom-workflow-microservices.md** - Microservices-specific workflow continuation (Unit of Work → Per-Unit Development)
- **.kiro/steering/custom-spec-format.md** - Specification format definitions for AI-DLC tool integration

### Kiro Advantages
- **Advanced Kiro Steering**: Identical enhanced workflow with requirements verification and session continuity
- **Complete Workflow Coverage**: Same comprehensive AI-DLC process as Amazon Q
- **Requirements Verification**: Built-in gap analysis and validation
- **Session Management**: Seamless project resumption with context preservation

## Performance Benefits

### Amazon Q Load-on-Demand Architecture
- **85% Reduction**: System prompt size reduced from 1000+ lines to 152 lines
- **Faster Responses**: Smaller prompts enable quicker AI processing
- **Better Context Management**: More room for conversation history and user context
- **Selective Loading**: Only relevant detailed steps loaded when needed
- **Consistent Experience**: Same comprehensive workflow with improved performance
