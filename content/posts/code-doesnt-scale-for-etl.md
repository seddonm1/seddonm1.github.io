---
title: "Code doesn't scale for ETL"
date: 2019-07-19
draft: false
tags: ["development", "spark"]
---

## History of the problem

Since Hadoop was released in 2007 users have been struggling to use it to deploy reliable and scalable Extract-Transform-Load (ETL) data pipelines. This was exacerbated in the early days by the ecosystem still being in flux - it felt like every day there was another major Apache Foundation project being announced adding to the Hadoop ecosystem. Now with the convergence of the adoption of cloud infrastructure, much more powerful hardware/faster networking and maturity of open-source solutions like Apache Spark it should be easier than ever to build ETL pipelines - but organisations are still grappling with how to rapidly deliver reliable and scalable ETL pipelines. 

## Just do Code?

Companies usually default to transforming data by manually programming them with languages like Scala, Java or Python. This seems sensible given that most large organisations have a workforce already trained in Java or similar languages who likely have the engineering knowledge to build ETL pipelines. 

But this approach breaks in several ways:

### Optimising the wrong problem

A bespoke engineered solution to a problem should always outperform a generalised engineered solution when optimising for pure efficiency. The problem with this approach is that the cost in time of skilled labour that can perform the optimisation required is often greater than the cost of increasing the hardware resources available to a pipeline (scaling either verically or horizontally) and that is before accounting for the fact that in 12 months that hardware will decrease in cost again. Does the labour cost (and time-to-market opportunity cost) outweigh the cost of bigger hardware?

### Repeatly solving the same problem

Extract-Transform-Load has been around for so long that we have a good understanding of the patterns (or components) that are typically required. In other software engineering diciplines we have seen users rally around opinionated frameworks such as [Ruby on Rails](https://rubyonrails.org/) and [React](https://reactjs.org/) in the web space and things like [Terraform](https://www.terraform.io) for devops which provide standard patterns and predictable behaviour without 'reinventing the wheel' each time. With ETL we see people continuously re-implementing the same logic differently which slows time-to-market, increases the surface-area of code and decreases the testing coverage.

### Writing how to get what they want, not what they want

When implementing ETL as code most programmers will implement imperative style code: meaning the programmer writes **how to get what they want** whereas with a declarative style the programmer writes **what they want**. The difference is that if the business rules remain constant then the declarative code remains the same regardless of the underlying execution/technology compared with an imperative approach which will likely require a code rewrite.

Fortuantely, in the data space, an excellent abstraction layer for writing declarative business logic already exists in the form of [Structured Query Language](https://en.wikipedia.org/wiki/SQL) (SQL). The clear benefit of adopting a declarative approach for ETL was demonstrated when [Apache Spark](https://spark.apache.org/) implemented the same SQL dialect as Hadoop Hive and users were able to run the same SQL query unchanged and receive significantly improved performance. This was seen again with the Spark 2.0 release which dramatically increased execution performance again.

## The Alternative: Configuration Driven

The solution that we have found to be most scalable is to agree on an approach for building Extract-Transform-Load pipelines where standard components are executed in different orders to build a pipeline with predictable behaviour. These components can then be abstracted them behind a configuration format that allows declarative ETL. This is an implementation of an idea from this article: [Engineers Shouldn't Write ETL](https://multithreaded.stitchfix.com/blog/2016/03/16/engineers-shouldnt-write-etl/).

### Skills Aligned Workforce

Standardising ETL component makes data engineering accessible to audiences outside of data engineers - you don't need to be proficient at Scala/Spark to introduce data engineering into your team and the training effort to upskill workers is reduced. If you can enable a member of your organisation who is able to define business rules to also implement those rules then the issues relating to communication and understanding of the intent of those rules (often by someone who is must closer to the code-optimisation skillset than has knowledge of the business) go away. This allows engineering to focus on what they do best, optimising the framework, and users who understand the business to focus on digitising those business rules.

### Less Technical Debt

Every line of code, no matter how fundamental to your business, is technical debt: there is a cost to maintain, test and carries a cognitive cost to understand its purpose. By abstracting the problem to a series of components with documented interfaces it is easy to re-implement just the desired behaviour against future execution engines and leave the configuration - which describes the **intent** of the pipeline - unchanged.

### Time to Market

Having standard components means that those components will behave in a predictable way regardless of how they are executed. This allows provision of a user interface to help build jobs at design time and allowing experimentation with different approaches then rapidly deploying the same configuration to production without any intermediaries.

### A path to production for Machine Learning

Machine Learning is a highly specialised data transformation which fits into the transformation stage of an extract-transform-load pipeline. Providing standard components to invoke models means Machine Learning practitioners have a clear interface specification to meet and the ETL pipeline can easily invoke the model just like any other data transformation stage.

## Arc: A Solution

The solution we have created to this problem is [Arc](https://arc.tripl.ai/) an opinionated framework for defining predictable, repeatable and manageable data transformation pipelines. It comes with a full set of standardised components, a plugin system which allows extending with custom business logic not possible with the standard components and a [user interface](https://github.com/tripl-ai/arc-jupyter) for rapid job development. It has been built with full operations management in mind (i.e. logging and environment variable parameters) and has been successfully used in production to process billions of rows. 

We encourage you to try the [starter project](https://github.com/tripl-ai/arc-starter) for a data-included quick introduction.