import fs from 'fs';
import GitHubAPI from 'github';
import ejs from 'ejs';
import dotenv from 'dotenv';

dotenv.config();

const DEBUG = process.env.NODE_ENV === 'development';
const GITHUB_AUTH_TOKEN = process.env.GITHUB_AUTH_TOKEN;
const templateFilePath = `${__dirname}/template.md`;
const outputFilePath = `${__dirname}/../README.md`;
const getToKnowData = require('../data/get-to-know.json');
let openSourceProjectsData = require('../data/open-source-projects.json');
const applicationsData = require('../data/applications.json');
const socialData = require('../data/social.json');
const researchOutletsData = require('../data/research-outlets.json');
const interactiveApplicationsData = require('../data/interactive-applications.json');
const currentStatusData = require('../data/current-status.json');
const contentsData = require('../data/contents.json');
const educationData = require('../data/education.json');
const booksData = require('../data/books.json');
const hackathonsData = require('../data/hackathons.json');
const vaccinationData = require('../data/vaccination.json');

const github = new GitHubAPI({
  debug: DEBUG,
  followRedirects: false,
  timeout: 10000,
  Promise: Promise,
});

github.authenticate({
  type: 'oauth',
  token: GITHUB_AUTH_TOKEN,
});

const repositories = openSourceProjectsData.list
  .map((item: {repositories: string[], category: string, anchor: string}) => {
    const fetchReposPromise = item.repositories
      .map((repoPath: string) => {
        const separatedRepoPath = repoPath.split('/');
        return github.repos.get({
          user: separatedRepoPath[0],
          repo: separatedRepoPath[1],
        });
      });
    const allSettled = fetchReposPromise.map(p => Promise.resolve(p)
      .then(
        val => ({ state: 'fulfilled', value: val }),
        err => ({ state: 'rejected', reason: err })));
    return Promise
      .all(allSettled)
      .then(rawResult => {
        const result = rawResult
          .filter(({ state, value }: {state: string, value: {name: string, owner: string, stargazers_count: number}}) => {
            if (state === 'fulfilled' && value && value.name && value.owner) {
              return true;
            }
          })
          .map(({ value }: {state: string, value: {name: string, owner: string, stargazers_count: number}}) => value);
        return {
          category: item.category,
          repositories: result.sort((a: {stargazers_count: number}, b: {stargazers_count: number}) => a.stargazers_count < b.stargazers_count ? 1 : -1),
          anchor: item.anchor || item.category.toLowerCase(),
        };
      });
  });

Promise
  .all(repositories)
  .then((openSourceList: object) => {
    const data = {
      contents: contentsData,
      openSource: { list: openSourceList, title: openSourceProjectsData.title },
      getToKnow: getToKnowData,
      applications: applicationsData,
      social: socialData,
      researchOutlets: researchOutletsData,
      interactiveApplications: interactiveApplicationsData,
      currentStatus: currentStatusData,
      education: educationData,
      books: booksData,
      hackathons: hackathonsData,
      vaccination: vaccinationData,
    };
    const template = fs.readFileSync(templateFilePath, 'utf8');
    const markdown = ejs.render(template, data);
    fs.writeFileSync(outputFilePath, markdown);
  })
  .catch(error => {
    console.error(error);
  });
