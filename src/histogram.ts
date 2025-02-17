import { ItemValue, Question } from "survey-core";
import { DataProvider } from "./dataProvider";
import { SelectBase } from "./selectBase";

export class HistogramModel extends SelectBase {
  protected valueType: "date" | "number" = "number";
  private _cachedValues: Array<{ original: any, continious: number }> = undefined;
  private _continiousData: { [series: string]: Array<number> } = undefined;
  private _cachedIntervals: Array<{ start: number, end: number, label: string }> = undefined;
  protected chartTypes: string[];
  public chartType: string;

  public static IntervalsCount = 10;
  public static UseIntervalsFrom = 10;

  constructor(
    question: Question,
    data: Array<{ [index: string]: any }>,
    options?: Object,
    name?: string
  ) {
    super(question, data, options, name || "histogram");
    const questionType = question.getType();
    if (questionType === "text" && (question["inputType"] === "date" || question["inputType"] === "datetime")) {
      this.valueType = "date";
    } else {
      this.valueType = "number";
    }
  }

  private reset() {
    this._continiousData = undefined;
    this._cachedValues = undefined;
    this._cachedIntervals = undefined;
  }

  public getContiniousValue(value: any): number {
    if (this.valueType === "date") {
      return Date.parse(value);
    }
    return Number.parseFloat(value);
  }

  public getString(value: number): string {
    if (this.valueType === "date") {
      return new Date(value).toLocaleDateString();
    }
    return "" + value;
  }

  public getSelectedItemByText(itemText: string) {
    if (this.hasCustomIntervals || this.getContiniousValues().length > HistogramModel.UseIntervalsFrom) {
      const interval = this.intervals.filter(interval => interval.label === itemText)[0];
      return new ItemValue(interval, interval !== undefined ? interval.label : "");
    }
    const originalValue = this.getLabels().filter(label => label === itemText)[0];
    return new ItemValue(originalValue, originalValue);
  }

  /**
   * Updates visualizer data.
   */
  public updateData(data: Array<{ [index: string]: any }>) {
    this.reset();
    super.updateData(data);
  }

  protected onDataChanged() {
    this.reset();
    super.onDataChanged();
  }

  protected getContiniousValues() {
    if (this._cachedValues === undefined) {
      const series = this.getSeriesValues();
      if (series.length === 0) {
        series.push("");
      }
      this._continiousData = {};
      series.forEach(seriesValue => this._continiousData[seriesValue] = []);
      const hash = {};
      this.data.forEach(dataItem => {
        const answerData = dataItem[this.dataName as string];
        if (answerData !== undefined) {
          const seriesValue = dataItem[DataProvider.seriesMarkerKey] || "";
          // TODO: _continiousData should be sorted in order to speed-up statistics calculation in the getData function
          this._continiousData[seriesValue].push(this.getContiniousValue(answerData));
          hash[answerData] = 0;
        }
      });
      this._cachedValues = Object.keys(hash).map(key => ({ original: key, continious: this.getContiniousValue(key) }));
      this._cachedValues.sort((a, b) => a.continious - b.continious);
    }
    return this._cachedValues;
  }

  public getValues(): Array<any> {
    const continiousValues = this.getContiniousValues();
    if (this.hasCustomIntervals || continiousValues.length > HistogramModel.UseIntervalsFrom) {
      return this.intervals.map(interval => interval.label);
    }
    return continiousValues.map(value => value.original);
  }

  public getLabels(): Array<string> {
    const continiousValues = this.getContiniousValues();
    if (this.hasCustomIntervals || continiousValues.length > HistogramModel.UseIntervalsFrom) {
      return this.intervals.map(interval => interval.label);
    }
    return continiousValues.map(value => value.original);
  }

  public get hasCustomIntervals() {
    return !!this.questionOptions && Array.isArray(this.questionOptions.intervals);
  }

  public get intervals() {
    if (this.hasCustomIntervals) {
      return this.questionOptions.intervals;
    }

    if (this._cachedIntervals === undefined) {
      const continiousValues = this.getContiniousValues();
      this._cachedIntervals = [];
      if (continiousValues.length) {
        let start = continiousValues[0].continious - 1;
        const end = continiousValues[continiousValues.length - 1].continious + 1;
        const intervalsCount = HistogramModel.IntervalsCount;
        const delta = (end - start) / intervalsCount;
        for (let i = 0; i < intervalsCount; ++i) {
          const next = start + delta;
          this._cachedIntervals.push({
            start: start,
            end: next,
            label: "" + this.getString(start) + "-" + this.getString(next)
          });
          start = next;
        }
      }
    }
    return this._cachedIntervals;
  }

  public getData() {
    const continiousValues = this.getContiniousValues();
    if (!this.hasCustomIntervals && continiousValues.length <= HistogramModel.UseIntervalsFrom) {
      return super.getData();
    }
    const intervals = this.intervals;
    const statistics: Array<Array<number>> = [];
    const series = this.getSeriesValues();
    if (series.length === 0) {
      series.push("");
    }
    for (var i = 0; i < series.length; ++i) {
      statistics.push(intervals.map(i => 0));
      this._continiousData[series[i]].forEach(dataValue => {
        for (let j = 0; j < intervals.length; ++j) {
          if (intervals[j].start <= dataValue && dataValue < intervals[j].end) {
            statistics[i][j]++;
            break;
          }
        }
      });
    }
    return statistics;
  }
}
