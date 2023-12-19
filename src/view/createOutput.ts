import * as core from "@actions/core";
import { getMultipleValuesInput } from "../common/utils";
import { Collection } from "../converters/types";
import { createMarkdown } from "./createMarkdown";
import { createIssue } from "../requests";
import {
  StatsType,
  createTimelineMonthsGanttBar,
  getDisplayUserList,
  sortCollectionsByDate,
} from "./utils";
import { octokit } from "../octokit/octokit";

export const createOutput = async (
  data: Record<string, Record<string, Collection>>
) => {
  const outcomes = getMultipleValuesInput("EXECUTION_OUTCOME");
  for (let outcome of outcomes) {
    const users = getDisplayUserList(data);
    const dates = sortCollectionsByDate(data.total);
    if (outcome === "new-issue") {
      const markdown = createMarkdown(
        data,
        users,
        ["total"],
        `Pull Request report total`
      );
      const issue = await createIssue(
        markdown.concat(
          `\n${getMultipleValuesInput("AGGREGATE_VALUE_METHODS")
            .filter((method) =>
              ["average", "median", "percentile"].includes(method)
            )
            .map((type) =>
              users
                .filter(
                  (user) =>
                    Object.values(data[user]).filter(
                      (value) =>
                        value.timeToReview &&
                        value.timeToApprove &&
                        value.timeToMerge
                    ).length > 2
                )
                .map((user) =>
                  createTimelineMonthsGanttBar(
                    data,
                    type as StatsType,
                    dates.filter((date) => date !== "total"),
                    user
                  )
                )
                .join("\n")
            )
            .join("\n")}`
        )
      );
      console.log("Issue successfully created.");
      for (let date of dates) {
        if (date === "total") continue;
        const commentMarkdown = createMarkdown(
          data,
          users,
          [date],
          `Pull Request report ${date}`
        );
        if (commentMarkdown === "") continue;
        await octokit.rest.issues.createComment({
          repo:
            core.getInput("GITHUB_REPO_FOR_ISSUE") ||
            process.env.GITHUB_REPO_FOR_ISSUE!,
          owner:
            core.getInput("GITHUB_OWNER_FOR_ISSUE") ||
            process.env.GITHUB_OWNER_FOR_ISSUE!,
          issue_number: issue.data.number,
          body: commentMarkdown,
        });
      }
    }
    if (outcome === "markdown" || outcome === "output") {
      const markdown = createMarkdown(data, users, dates);
      console.log("Markdown successfully generated.");
      core.setOutput("MARKDOWN", markdown);
    }
    if (outcome === "collection") {
      core.setOutput("JSON_COLLECTION", JSON.stringify(data));
    }
  }
};