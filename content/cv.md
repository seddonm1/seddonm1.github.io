---
title: "CV"
layout: "cv"
draft: true
---

# Mike Seddon
**Principal Engineer**
Greater Sydney Area

## Contact
*   **Email:** seddonm1@gmail.com
*   **LinkedIn:** [linkedin.com/in/mikeseddonau](https://www.linkedin.com/in/mikeseddonau)
*   **Personal Website:** [reorchestrate.com](http://reorchestrate.com)

## Summary
Experienced hands-on Principal Engineer and Solutions Architect with deep expertise in Generative AI, GPU-accelerated computing, and large-scale data platforms. Proven track record delivering ML/AI systems end-to-end including LLM integration, RAG implementations, and agentic AI workflows, having deployed high-performance GPU inference on NVIDIA hardware in Rust and Python. Strong background in partner and stakeholder enablement through consulting, workshops, and technical community talks. Extensive direct experience across AWS, GCP, and Azure with a wide range of ML frameworks and programming languages.

## Top Skills
*   Generative AI / LLMs / RAG
*   GPU Computing / NVIDIA Inference
*   Solution Architecture
*   Python / Rust / PyTorch

## Technical Skills
*   **Languages:** Python, Rust, TypeScript, SQL, C
*   **ML/AI:** PyTorch, LLMs, RAG, Small Language Models, Computer Vision
*   **GPU:** NVIDIA GPUs, GPU-accelerated inference, wgpu/Vulkan
*   **Cloud:** AWS (EKS, S3, IAM), GCP (Kubernetes, IAM), Azure (Blob Storage, SQL DW)
*   **Infrastructure:** Kubernetes, Docker, Terraform, Apache Spark, NVIDIA DeepStream/GStreamer

## Experience

### Commonwealth Bank
**Principal Engineer - Generative AI**
*March 2025 – Present (1 year 1 month)*
*Sydney, New South Wales, Australia*

*   Drove the reimplementation of the CBA Generative AI Guardrails focusing heavily on simplicity, high coverage (99%+) and code quality while still allowing extensibility via plugins.
*   Hands-on work with LLMs including implementing RAG pipelines and training small language models to replace LLM calls in guardrails, reducing cost and latency.
*   Strong use of modern Python industry tooling (uv, ruff) to bring as much static analysis benefit to Python as possible.

### Truyu
**Chief Technology Officer / Principal Engineer**
*March 2024 – March 2025 (1 year 1 month)*
*Sydney, New South Wales, Australia*

*   Full rewrite from a GraphQL/Azure Functions to an extremely simple single-container REST service (with OpenAPI specification) backed by Postgres in Typescript. 
*   Achieved transaction guarantees by using the active record pattern and implementation of async Graphile worker queues. 
*   Heavily use of code generation from API specifications to create type-safe clients including from the Truyu mobile application.

### VisualCortex
**Head of Machine Learning / Artificial Intelligence**
*April 2021 – March 2024 (3 years)*
*Sydney, New South Wales, Australia*

*   Owned the end-to-end ML pipeline as an NVIDIA partner: data collection, labelling, PyTorch model training, evaluation, and production deployment on NVIDIA GPUs exclusively (from Jetson to T4/A100).
*   Built a high-performance inference framework in Rust (migrated from Python) using NVIDIA DeepStream/GStreamer to maximise GPU utilisation. The framework processed tens-of-billions of frames in production with a heavy focus on efficient inference and maximum throughput.
*   Managed and coached a small team of developers on model building and production deployment.

### One Mount Group
**Principal Architect**
*August 2020 – March 2021 (8 months)*
*Sydney, New South Wales, Australia*

*   Worked within the Chief Data Office to design the future Data Platform to support Decisioning, applied Machine Learning and safe, federated use of data within the organisation. 
*   Design built upon previous learnings where strong audit guarantees are supported by a combination of immutable data and strong end-to-end transaction guarantees.
*   Implementation entirely on Google Cloud Platform leveraging IAM for security plus Kubernetes/Apache Spark as an on-demand compute engine. 
*   Orchestration via Argo/Kubernetes and deployed with Terraform. 
*   The solution allows multi-cloud portability and is built upon primitives that exist on all major cloud platforms.

### Commonwealth Bank
**Senior Solutions Architect**
*August 2019 – August 2020 (1 year 1 month)*
*Sydney, New South Wales, Australia*

*   Designed a multi-cloud Data Platform intended to replace a large on-premise proprietary data warehouse. 
*   Built a proof-of-concept against Amazon Web Services utilising Elastic Kubernetes Service (EKS), Amazon S3, and AWS IAM.
*   Followed principles of providing strong end-to-end transactional guarantees and data immutability for reproducible data transformation pipelines with strong audit guarantees.

### AGL Energy
**Senior Data Engineer**
*June 2017 – July 2019 (2 years 2 months)*
*Sydney, New South Wales, Australia*

*   Designed and built the Arc ETL Framework - an opinionated framework for defining predictable, repeatable and manageable data transformation pipelines. 
*   Deployed on Azure with Azure Blob Storage and Apache Spark on ephemeral compute nodes and used Azure SQL DW as a mass consumption layer.
*   Framework facilitated the bulk movement of data (5-10 billion records daily) including Energy Insights, a service using machine learning to provide electricity usage insights.

### SenseAg
**Co-Founder**
*April 2016 – June 2019 (3 years 3 months)*
*Sydney, New South Wales, Australia*

*   Co-founded an Australian Agricultural Technology (AgTech) startup combining IoT, distributed sensor networks, big data, and machine learning.
*   Work included end-to-end software development from low-level C code on embedded devices to dashboards in an offline-first progressive web application.

### Commonwealth Bank
**Data Engineer/Development Specialist**
*July 2016 – June 2017 (1 year)*
*Sydney, New South Wales, Australia*

*   Designed, built and implemented Commonwealth Bank's ETL Pipeline using Apache Spark. 
*   Pipeline processes almost 100 billion records in approximately 1 hour daily.
*   Highlighted the importance of a SQL-first approach to data engineering.

### KPMG Australia
**Manager, Business Intelligence and Analytics, Advisory Services**
*September 2014 – June 2016 (1 year 10 months)*
*Sydney, New South Wales, Australia*

*   Revenue Assurance work for major Telecommunications company focusing on reconciliation of revenue from order to bill.
*   Visualisation of revenue flows built with custom Javascript extensions with a common dashboard tool.

### Infosys Lodestone
**Principal Architect**
*December 2012 – August 2014 (1 year 9 months)*
*Melbourne, Victoria, Australia*

*   Responsible for ensuring Data Quality of the Group Customer Master database at one of Australia's largest banks.
*   Remediated over 280,000 customers for critical issues and affected over 10 million records for usability issues.

### Zambian National AIDS Council
**Monitoring and Evaluation Advisor**
*October 2010 – May 2012 (1 year 8 months)*
*Lusaka, Zambia*

*   Developed and implemented an online stakeholder inventory/mapping and data collection tool to standardise how the HIV/AIDS response is monitored. 
*   Secured international funding through the World Bank, UNAIDS, UNDP, ILO, and IOM.

### ANZ
**4 years 9 months**

*   **Manager Analytics, Decision Support** (June 2009 – September 2010)
*   **Project Manager, Business Improvement** (March 2008 – May 2009)
*   **Business Analyst/Project Manager, Business Development and Re-engineering** (January 2006 – February 2008)
*   **Business Analyst/Developer, ANZ Investment Bank Technology** (January 2005 – November 2005)

## Education
**RMIT University**
Business Information Systems, Information Systems (2000 - 2004)

## Projects
*   [s3ite](https://github.com/seddonm1/s3ite) - An S3-compatible API backed by SQLite in Rust, designed for efficient ML training data storage and access
*   [sqlite-bench](https://github.com/seddonm1/sqlite-bench) - A SQLite benchmarking tool written in Rust
*   [web-llm](https://github.com/seddonm1/web-llm) - A wgpu (Vulkan/Metal/DX12) implementation of llama2.c in Rust, enabling LLM inference directly on GPU via WebGPU

## Talks & Writing
*   [Your binary is no longer safe](https://reorchestrate.com/posts/your-binary-is-no-longer-safe-decompilation/) - Using LLMs to autonomously decompile, convert, and verify binary programs via multi-step agentic workflows
*   [Rust GPU Compute](https://www.youtube.com/watch?v=3sk4ih0RULE) - Rust Sydney Meetup
*   [Rust Plugins with WASM](https://www.youtube.com/watch?v=X-u_WrLiLuc) - Rust Sydney Meetup

## Certifications
*   TOGAF® Certification
*   Lean Six Sigma Black Belt

## Honors-Awards
*   Winner Apache Spark Makers Build by IBM
